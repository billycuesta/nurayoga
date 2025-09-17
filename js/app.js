document.addEventListener('DOMContentLoaded', async () => {

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // --- Application State ---
    let currentDate = new Date();
    let sortKey = 'name';
    let sortDirection = 'asc';
    
    // --- UI Components ---
    let classModal, studentModal, templateModal, oneOffModal;
    let studentForm, templateForm, oneOffForm;
    let studentsTable, calendar;
    let studentDetailsModal;

    // --- UI Elements (para compatibilidad con HTML existente) ---
    const navHorario = document.getElementById('nav-horario');
    const navAlumnos = document.getElementById('nav-alumnos');
    const viewHorario = document.getElementById('view-horario');
    const viewAlumnos = document.getElementById('view-alumnos');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const currentWeekDisplay = document.getElementById('current-week-display');





    // --- Initialization ---
    async function initializeApp() {
    try {
        // Inicializar base de datos
        await window.db.init();

        // Comprueba y resetea los pagos mensuales
        await checkAndResetPayments();

        // Configurar componentes UI
        setupUIComponents();
        setupEditStudentModal();
        setupEventListeners();

        await populateTeacherFilter();
        // Cargar vista inicial
        await switchView('horario');

        NotificationUtils.success('Aplicación inicializada correctamente');
    } catch (error) {
        console.error("Initialization failed:", error);
        NotificationUtils.error('Error al inicializar la aplicación');
    }
}

    function setupUIComponents() {
        // Modales
        classModal = new Modal('class-modal');
        studentModal = new Modal('new-student-modal');
        templateModal = new Modal('schedule-template-modal');
        oneOffModal = new Modal('one-off-class-modal');
        studentDetailsModal = new Modal('student-details-modal'); 

        // Formularios con validación
        studentForm = new FormHandler('new-student-form', {
            clearOnSubmit: true
        });

        templateForm = new FormHandler('template-class-form', {
            clearOnSubmit: false // No limpiar para poder editar
        });

        oneOffForm = new FormHandler('one-off-class-form', {
            clearOnSubmit: false // No limpiar para poder editar
        });

        // Tabla de estudiantes
        studentsTable = new Table('students-table-container', {
            searchable: false, // Usamos el input de búsqueda existente
            emptyMessage: 'No se encontraron alumnos.'
        });

        setupStudentsTable();
        populateTimeSelects();
    }

    function setupStudentsTable() {
        // Configurar columnas de la tabla
        studentsTable.setColumns([
            { key: 'name', title: 'Nombre' },
            { key: 'email', title: 'Email', render: (student) => student.email || '-' },
            { key: 'phone', title: 'Teléfono', render: (student) => student.phone || '-' },
            { 
                key: 'actions', 
                title: 'Acciones',
                sortable: false,
                render: (student) => 
                    `<button data-id="${student.id}" class="delete-student-btn text-red-500 hover:text-red-700 font-semibold">Eliminar</button>`
            }
        ]);

        // Manejar clicks en botones de eliminar
        studentsTable.onRowClick((student, index, event) => {
            if (event.target.classList.contains('delete-student-btn')) {
                handleDeleteStudent(parseInt(event.target.dataset.id));
            }
        });
    }

    function setupFormValidators() {
        // Validadores para formulario de estudiante
        studentForm.addValidator('new-student-name', (value) => 
            ValidationUtils.validateString(value, 100)
        );
        
        studentForm.addValidator('new-student-email', (value) => {
            if (!value.trim()) return { isValid: true, error: null };
            return {
                isValid: ValidationUtils.isValidEmail(value),
                error: ValidationUtils.isValidEmail(value) ? null : 'Email no válido'
            };
        });

        studentForm.addValidator('new-student-phone', (value) => {
            if (!value.trim()) return { isValid: true, error: null };
            return {
                isValid: ValidationUtils.isValidPhone(value),
                error: ValidationUtils.isValidPhone(value) ? null : 'Teléfono no válido'
            };
        });

        // Validadores para formulario de clase template
        templateForm.addValidator('template-name', (value) => 
            ValidationUtils.validateString(value, 100)
        );
        
        templateForm.addValidator('template-time', (value) => {
            return {
                isValid: ValidationUtils.isValidTime(value),
                error: ValidationUtils.isValidTime(value) ? null : 'Hora no válida (HH:MM)'
            };
        });

        // Validadores para formulario de clase puntual
        oneOffForm.addValidator('one-off-name', (value) => 
            ValidationUtils.validateString(value, 100)
        );
        
        oneOffForm.addValidator('one-off-time', (value) => {
            return {
                isValid: ValidationUtils.isValidTime(value),
                error: ValidationUtils.isValidTime(value) ? null : 'Hora no válida (HH:MM)'
            };
        });
        
        oneOffForm.addValidator('one-off-date', (value) => {
            const isValid = ValidationUtils.isValidDate(value) && DateUtils.isFuture(value);
            return {
                isValid: isValid,
                error: isValid ? null : 'La fecha debe ser futura y válida'
            };
        });
    }


function setupEventListeners() {
    // Navegación
    document.getElementById('nav-horario').addEventListener('click', () => switchView('horario'));
    document.getElementById('nav-alumnos').addEventListener('click', () => switchView('alumnos'));
    document.getElementById('nav-ingresos').addEventListener('click', () => switchView('ingresos'));
    document.getElementById('nav-configuracion').addEventListener('click', () => switchView('configuracion'));

    // Navegación de semanas
    document.getElementById('prev-week').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderCalendar();
    });
    
    document.getElementById('next-week').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderCalendar();
    });

    document.getElementById('teacher-filter-select').addEventListener('change', () => {
        renderCalendar();
    });

    // Búsqueda de estudiantes
    document.getElementById('student-search-input').addEventListener('input', (e) => {
        renderStudentsTable(e.target.value);
    });

    // Ordenación de tabla de alumnos
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const newSortKey = header.dataset.sortKey;
            if (sortKey === newSortKey) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortKey = newSortKey;
                sortDirection = 'asc';
            }
            renderStudentsTable(document.getElementById('student-search-input').value); 
        });
    });

    // Botones para abrir modales principales
    document.getElementById('open-new-student-modal').addEventListener('click', () => studentModal.show());
    document.getElementById('open-template-modal-btn').addEventListener('click', () => {
        resetTemplateForm();
        templateModal.show();
    });
    document.getElementById('open-one-off-class-modal-btn').addEventListener('click', () => {
        resetOneOffForm();
        oneOffModal.show();
    });

    // --- MANEJADORES DE GUARDADO DE FORMULARIOS ---

    // Guardar nuevo alumno
    studentForm.onSubmit(async (formData) => {
        try {
            const studentData = {
                name: formData['new-student-name'],
                email: formData['new-student-email'],
                phone: formData['new-student-phone']
            };
            const student = new Student(studentData);
            await student.save();
            NotificationUtils.success('Alumno guardado correctamente');
            studentModal.hide();
            await renderStudentsTable();
            await renderStudentStats();
        } catch (error) {
            console.error('Error al guardar el alumno:', error);
            NotificationUtils.error(`Error al guardar: ${error.message}`);
        }
    });

    // Guardar Clase Puntual
// app.js -> Reemplaza tu función oneOffForm.onSubmit

oneOffForm.onSubmit(async (formData) => {
    try {
        const classId = formData['one-off-class-id'] ? parseInt(formData['one-off-class-id']) : null;
        const hour = document.getElementById('one-off-time-hour').value;
        const minute = document.getElementById('one-off-time-minute').value;
        
        if (!hour || !minute) {
            NotificationUtils.error('Por favor, selecciona una hora y minutos válidos.');
            return;
        }
        const combinedTime = `${hour}:${minute}`;
        const date = formData['one-off-date'];

        // --- INICIO: LÓGICA DE VALIDACIÓN MEJORADA ---
        
        // 1. Comprobar contra otras clases PUNTUALES
        const allOneOffClasses = await OneOffClass.findAll();
        const conflictWithOneOff = allOneOffClasses.some(
            clase => clase.date === date && 
                     clase.time === combinedTime && 
                     clase.id !== classId
        );

        if (conflictWithOneOff) {
            NotificationUtils.error('Ya existe otra clase puntual en esa misma fecha y hora.');
            return;
        }

        // 2. Comprobar contra clases FIJAS
        const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // Domingo=0, Lunes=1, ...
        const appDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convertimos a la convención de la app (Lunes=1, ...)
        
        const allRecurringClasses = await RecurringClass.findAll();
        const conflictWithRecurring = allRecurringClasses.some(
            clase => clase.day === appDay &&
                     clase.time === combinedTime
        );

        if (conflictWithRecurring) {
            NotificationUtils.error('El horario coincide con una clase fija programada para ese día de la semana.');
            return;
        }
        // --- FIN: LÓGICA DE VALIDACIÓN MEJORADA ---

        const classData = {
            id: classId,
            date: date,
            name: formData['one-off-name'],
            teacher: formData['one-off-teacher-select'],
            capacity: parseInt(formData['one-off-capacity']),
            time: combinedTime
        };

        const oneOffClass = new OneOffClass(classData);
        await oneOffClass.save();
        
        NotificationUtils.success(`Clase puntual ${classId ? 'actualizada' : 'guardada'} correctamente.`);
        oneOffModal.hide();
        await renderCalendar();

    } catch (error) {
        console.error('Error saving one-off class:', error);
        NotificationUtils.error(`Error al guardar la clase: ${error.message}`);
    }
});


templateForm.onSubmit(async (formData) => {
    try {
        const classId = formData['template-class-id'] ? parseInt(formData['template-class-id']) : null;
        const hour = document.getElementById('template-time-hour').value;
        const minute = document.getElementById('template-time-minute').value;

        if (!hour || !minute) {
            NotificationUtils.error('Por favor, selecciona una hora y minutos válidos.');
            return;
        }
        const combinedTime = `${hour}:${minute}`;
        const day = parseInt(formData['template-day']);

        // --- INICIO: LÓGICA DE VALIDACIÓN MEJORADA ---

        // 1. Comprobar contra otras clases FIJAS
        const allRecurringClasses = await RecurringClass.findAll();
        const conflictWithRecurring = allRecurringClasses.some(
            clase => clase.day === day && 
                     clase.time === combinedTime && 
                     clase.id !== classId
        );

        if (conflictWithRecurring) {
            NotificationUtils.error('Ya existe otra clase fija en ese mismo día y hora.');
            return;
        }
        
        // 2. Comprobar contra clases PUNTUALES en la semana actual
        const startOfWeek = DateUtils.getStartOfWeek(currentDate);
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + (day - 1)); // day es 1-indexed (Lunes=1)
        const targetDateString = DateUtils.toDateString(targetDate);

        const allOneOffClasses = await OneOffClass.findAll();
        const conflictWithOneOff = allOneOffClasses.some(
            clase => clase.date === targetDateString &&
                     clase.time === combinedTime
        );
        
        if (conflictWithOneOff) {
            NotificationUtils.error(`El horario coincide con una clase puntual programada para el ${targetDate.toLocaleDateString('es-ES',{day:'numeric', month:'numeric'})}.`);
            return;
        }
        // --- FIN: LÓGICA DE VALIDACIÓN MEJORADA ---

        const classData = {
            id: classId,
            day: day,
            name: formData['template-name'],
            teacher: formData['template-teacher-select'],
            capacity: parseInt(formData['template-capacity']),
            time: combinedTime
        };
        
        const recurringClass = new RecurringClass(classData);
        await recurringClass.save();

        NotificationUtils.success(`Clase fija ${classId ? 'actualizada' : 'guardada'} correctamente.`);
        resetTemplateForm();
        await renderCalendar();

    } catch (error) {
        console.error('Error saving recurring class template:', error);
        NotificationUtils.error(`Error al guardar la clase: ${error.message}`);
    }
});

    // --- FIN: LÓGICA PARA GUARDAR CLASE FIJA ---

    // Botones de la sección de Configuración
    document.getElementById('export-data-btn').addEventListener('click', handleExportData);
    const importInput = document.getElementById('import-data-input');
    document.getElementById('import-data-btn').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImportData);
    document.getElementById('clear-all-inscriptions-btn').addEventListener('click', handleClearAllInscriptions);
    document.getElementById('delete-all-students-btn').addEventListener('click', handleDeleteAllStudents);

    // Event delegation para la tabla de alumnos
    const studentsTableBody = document.getElementById('students-table-body');
    studentsTableBody.addEventListener('click', (e) => {
        const target = e.target;
        
        const paymentCell = target.closest('.payment-status-cell');
        if (paymentCell) {
            const studentId = parseInt(paymentCell.closest('tr').dataset.studentId);
            if (studentId) {
                handleTogglePayment(studentId);
            }
            return;
        }
        
        const studentRow = target.closest('.student-row-clickable');
        if (studentRow) {
            const studentId = parseInt(studentRow.dataset.studentId);
            if (studentId && !target.closest('button')) {
                showStudentDetails(studentId);
            }
        }
    });
}
    
    function setupTeacherSelects() {
        const templateSelect = document.getElementById('template-teacher-select');
        const oneOffSelect = document.getElementById('one-off-teacher-select');

        [templateSelect, oneOffSelect].forEach(select => {
            select.addEventListener('change', async (e) => {
                if (e.target.value === 'new-teacher') {
                    const newTeacherName = prompt('Introduce el nombre del nuevo/a profesor/a:');
                    if (newTeacherName && newTeacherName.trim()) {
                        try {
                            const teacher = new Teacher({ name: newTeacherName.trim() });
                            await teacher.save();
                            
                            NotificationUtils.success('Profesor añadido correctamente');
                            await populateTeacherSelects(newTeacherName.trim());
                        } catch (error) {
                            console.error('Error adding teacher:', error);
                            NotificationUtils.error('Error al añadir profesor');
                            e.target.value = '';
                        }
                    } else {
                        e.target.value = '';
                    }
                }
            });
        });
    }

    // --- Rendering Functions ---

    async function renderCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        calendarGrid.innerHTML = '';
        
        // 1. LEER EL VALOR DEL FILTRO
        const selectedTeacher = document.getElementById('teacher-filter-select').value;

        const startOfWeek = DateUtils.getStartOfWeek(currentDate);
        currentWeekDisplay.textContent = `Semana del ${startOfWeek.toLocaleDateString('es-ES', {day: 'numeric', month: 'long'})}`;
        const weekDays = DateUtils.getWeekdayNames();
        
        const [recurringClasses, oneOffClasses, inscriptions, recurringInscriptions] = await Promise.all([
            RecurringClass.findAll(),
            OneOffClass.findAll(),
            window.db.getAllInscriptions(),
            window.db.getAllRecurringInscriptions()
        ]);

        for (let i = 0; i < 5; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dayDateString = DateUtils.toDateString(dayDate);
            
            const dayColumn = DOMUtils.createElement('div');
            const dayHeader = DOMUtils.createElement('h3', 
                'text-xl font-bold text-center mb-4 text-gray-600',
                `${weekDays[i]} <span class="text-sm font-normal">${dayDate.toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</span>`
            );
            dayColumn.appendChild(dayHeader);
            
            const dayRecurringClasses = recurringClasses.filter(c => c.day === i + 1);
            const dayOneOffClasses = oneOffClasses.filter(c => c.date === dayDateString);
            
            let allClasses = [ // Usamos 'let' en lugar de 'const' para poder reasignarla
                ...dayRecurringClasses.map(c => ({ ...c, type: 'recurring' })),
                ...dayOneOffClasses.map(c => ({ ...c, type: 'one-off' }))
            ].sort((a, b) => a.time.localeCompare(b.time));

            // 2. APLICAR EL FILTRO
            if (selectedTeacher !== 'all') {
                allClasses = allClasses.filter(classData => classData.teacher === selectedTeacher);
            }

            const classesContainer = DOMUtils.createElement('div', 'space-y-4');
            
            if (allClasses.length === 0) {
                classesContainer.appendChild(
                    DOMUtils.createElement('div', 'text-center text-gray-400 mt-8', 'No hay clases programadas.')
                );
            } else {
                for (const classData of allClasses) {
                    const currentInscriptions = classData.type === 'recurring' 
                        ? recurringInscriptions.filter(i => i.templateId === classData.id).length
                        : inscriptions.filter(i => i.oneOffClassId === classData.id).length;
                        
                    const isFull = currentInscriptions >= classData.capacity;
                    const card = Card.createClassCard(classData, currentInscriptions, isFull);
                    
                    card.dataset.id = classData.id;
                    card.dataset.type = classData.type;
                    card.dataset.date = dayDateString;
                    
                    card.addEventListener('click', () => openClassModal(classData, dayDateString));
                    classesContainer.appendChild(card);
                }
            }
            
            dayColumn.appendChild(classesContainer);
            calendarGrid.appendChild(dayColumn);
        }
    }

    function updateSortIndicators() {
        document.querySelectorAll('.sortable-header').forEach(header => {
            const indicator = header.querySelector('.sort-indicator');
            if (header.dataset.sortKey === sortKey) {
                indicator.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
            } else {
                indicator.textContent = '';
            }
        });
    }


    async function renderStudentsTable(filter = '', students = null) {
        updateSortIndicators();

        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '';
        // Si no nos pasan la lista de alumnos, la buscamos
        if (students === null) {
            students = await Student.findAll();
        }

        const currentMonthKey = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;

        const rowsMap = new Map();
        tbody.querySelectorAll('tr[data-student-id]').forEach(row => {
            rowsMap.set(row.dataset.studentId, row);
        });

        const visibleStudentIds = new Set();

        students.forEach(student => {
            const studentIdStr = student.id.toString();
            const matchesFilter = !filter || student.name.toLowerCase().includes(filter.toLowerCase()) || (student.email && student.email.toLowerCase().includes(filter.toLowerCase()));

            if (matchesFilter) {
                visibleStudentIds.add(student.id);
            }

            let row = rowsMap.get(studentIdStr);

            const paymentDate = student.getPaymentDateForMonth(currentMonthKey);
            let paymentStatusHTML = '';
            if (paymentDate) {
                paymentStatusHTML = `<div class="payment-status-cell cursor-pointer p-2 rounded-md transition-colors hover:bg-green-200"><span class="font-semibold text-green-600">Pagado</span></div>`;
            } else {
                paymentStatusHTML = `<div class="payment-status-cell cursor-pointer p-2 rounded-md transition-colors hover:bg-red-200"><span class="font-semibold text-red-500">No pagado</span></div>`;
            }

            if (!row) {
                row = document.createElement('tr');
                row.dataset.studentId = studentIdStr;
                row.className = 'border-b hover:bg-gray-50';
                
                row.innerHTML = `
                    <td class="p-4 font-medium text-gray-800">${student.name}</td>
                    <td class="p-4 payment-status-container">${paymentStatusHTML}</td>
                    <td class="p-4 flex items-center space-x-4">
                        <button class="edit-student-btn text-blue-600 hover:text-blue-800 font-semibold">Editar</button>
                        <button class="delete-student-btn text-red-500 hover:text-red-700 font-semibold">Eliminar</button>
                    </td>
                `;
                
                row.querySelector('.edit-student-btn').addEventListener('click', () => handleEditStudent(student.id));
                row.querySelector('.delete-student-btn').addEventListener('click', () => handleDeleteStudent(student.id));
                row.classList.add('student-row-clickable');
                
                tbody.appendChild(row);
            } else {
                // CÓDIGO CORREGIDO: Actualizamos el contenido de las celdas existentes
                row.cells[0].textContent = student.name;
                row.cells[1].innerHTML = paymentStatusHTML;
                // Si tuvieras más celdas, las actualizarías aquí también.
            }

            row.style.display = matchesFilter ? '' : 'none';
        });
        
        const sortedVisibleStudents = students
            .filter(s => visibleStudentIds.has(s.id))
            .sort((a, b) => {
                let valA, valB;
                switch (sortKey) {
                    case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                    case 'payment': valA = a.getPaymentDateForMonth(currentMonthKey) ? 1 : 0; valB = b.getPaymentDateForMonth(currentMonthKey) ? 1 : 0; break;
                    default: return 0;
                }
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return a.name.localeCompare(b.name);
            });

        if (sortDirection === 'desc') {
            sortedVisibleStudents.reverse();
        }

        sortedVisibleStudents.forEach(student => {
            const row = tbody.querySelector(`tr[data-student-id='${student.id}']`);
            if (row) {
                tbody.appendChild(row);
            }
        });

        const noResultsRow = tbody.querySelector('.no-results-row');
        if (sortedVisibleStudents.length === 0 && filter) {
            if (!noResultsRow) {
                tbody.insertAdjacentHTML('beforeend', '<tr class="no-results-row"><td colspan="3" class="text-center p-8 text-gray-500">No se encontraron alumnos.</td></tr>');
            }
        } else if (noResultsRow) {
            noResultsRow.remove();
        }
    }

    /**
     * Actualiza únicamente una fila de la tabla de alumnos sin redibujar todo.
     * @param {number} studentId - El ID del alumno a actualizar.
     */
    async function updateStudentRow(studentId) {
        const student = await Student.findById(studentId);
        if (!student) return;

        const row = document.querySelector(`#students-table-body tr[data-student-id='${student.id}']`);
        if (!row) return;

        // 1. Recalcular el HTML del estado de pago (lógica extraída de renderStudentsTable)
        const currentMonthKey = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const paymentDate = student.getPaymentDateForMonth(currentMonthKey);
        let paymentStatusHTML = '';
        
        if (paymentDate) {
            paymentStatusHTML = `<div class="payment-status-cell cursor-pointer p-2 rounded-md transition-colors hover:bg-green-200"><span class="font-semibold text-green-600">Pagado</span></div>`;
        } else {
            paymentStatusHTML = `<div class="payment-status-cell cursor-pointer p-2 rounded-md transition-colors hover:bg-red-200"><span class="font-semibold text-red-500">No pagado</span></div>`;
        }

        // 2. Encontrar la celda de pago y actualizar solo su contenido
        const paymentCell = row.querySelector('.payment-status-container');
        if (paymentCell) {
            paymentCell.innerHTML = paymentStatusHTML;
        }
    }



    async function renderTemplateEditor() {
        const templateDisplay = document.getElementById('template-display');
        templateDisplay.innerHTML = '';
        
        const templates = await RecurringClass.findAll();
        const sortedTemplates = DataUtils.sortBy(templates, 'day').sort((a, b) => {
            if (a.day === b.day) return a.time.localeCompare(b.time);
            return 0;
        });
        
        if (sortedTemplates.length === 0) {
            templateDisplay.appendChild(
                DOMUtils.createElement('p', 'text-center text-gray-500 col-span-full', 'No hay clases fijas definidas.')
            );
            return;
        }

        for (const template of sortedTemplates) {
            const card = DOMUtils.createElement('div', 
                'bg-gray-100 p-3 rounded-lg shadow-sm border flex justify-between items-center'
            );
            
            const borderColor = ColorUtils.getColorFromString(template.teacher);
            card.style.borderLeft = `4px solid ${borderColor}`;
            
            card.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800">${template.name}</p>
                    <p class="text-sm text-gray-500">${['L','M','X','J','V'][template.day-1]} - ${template.time} - ${template.capacity} plazas</p>
                    ${template.teacher ? `<p class="text-sm font-semibold" style="color: ${borderColor}">${template.teacher}</p>`: ''}
                </div>
                <div class="flex space-x-1">
                    <button data-id="${template.id}" class="edit-template-btn p-2 rounded-full hover:bg-gray-200">✏️</button>
                    <button data-id="${template.id}" class="delete-template-btn p-2 rounded-full hover:bg-gray-200">🗑️</button>
                </div>
            `;

            // Event listeners para editar y eliminar
            card.querySelector('.edit-template-btn').addEventListener('click', () => 
                handleEditTemplate(template.id)
            );
            
            card.querySelector('.delete-template-btn').addEventListener('click', () => 
                handleDeleteTemplate(template.id)
            );

            templateDisplay.appendChild(card);
        }
    }


// app.js -> Reemplaza tu función openClassModal actual por esta versión completa

async function openClassModal(classData, date) {
    const modal = document.getElementById('class-modal');
    modal.dataset.classId = classData.id;
    modal.dataset.classType = classData.type;
    modal.dataset.date = date; // Mantener la fecha por si acaso

    // --- Pestañas ---
    const tabAttendees = document.getElementById('tab-attendees');
    const tabDetails = document.getElementById('tab-details');
    const panelAttendees = document.getElementById('panel-attendees');
    const panelDetails = document.getElementById('panel-details');

    // Resetear al estado inicial (Asistentes visible)
    panelAttendees.classList.remove('hidden');
    panelDetails.classList.add('hidden');
    tabAttendees.classList.add('border-brand', 'text-brand');
    tabAttendees.classList.remove('border-transparent', 'text-gray-500');
    tabDetails.classList.add('border-transparent', 'text-gray-500');
    tabDetails.classList.remove('border-brand', 'text-brand');

    // Lógica de cambio de pestañas
    tabAttendees.onclick = () => {
        panelAttendees.classList.remove('hidden');
        panelDetails.classList.add('hidden');
        tabAttendees.classList.add('border-brand', 'text-brand');
        tabDetails.classList.remove('border-brand', 'text-brand');
    };
    tabDetails.onclick = () => {
        panelAttendees.classList.add('hidden');
        panelDetails.classList.remove('hidden');
        tabDetails.classList.add('border-brand', 'text-brand');
        tabAttendees.classList.remove('border-brand', 'text-brand');
    };
    
    // --- Rellenar Cabecera ---
    document.getElementById('modal-class-name').textContent = classData.name;
    document.getElementById('modal-class-teacher').textContent = classData.teacher || '';
    document.getElementById('modal-class-teacher').style.color = ColorUtils.getColorFromString(classData.teacher);
    if (classData.type === 'recurring') {
        const dayName = DateUtils.getDayName(new Date(date).getDay());
        document.getElementById('modal-class-time').textContent = `${dayName}, ${classData.time} (Fija)`;
    } else {
        const formattedDate = DateUtils.formatDisplayDate(date);
        document.getElementById('modal-class-time').textContent = `${formattedDate} - ${classData.time}`;
    }

    // --- Rellenar Panel de Asistentes ---
    await renderAttendeesList();
    await populateStudentSelect();

    // --- Rellenar Panel de Editar Detalles ---
    const form = document.getElementById('edit-class-form');
    const dateContainer = document.getElementById('edit-date-container');
    const dayContainer = document.getElementById('edit-day-container');

    // Mostrar/ocultar campo de día o fecha según el tipo de clase
    dateContainer.style.display = classData.type === 'one-off' ? 'block' : 'none';
    dayContainer.style.display = classData.type === 'recurring' ? 'block' : 'none';

    // Rellenar campos comunes
    form.elements['name'].value = classData.name;
    form.elements['capacity'].value = classData.capacity;
    
    // Rellenar selects de hora/minutos (con la lógica corregida)
    if (classData.time && classData.time.includes(':')) {
        const [hour, minute] = classData.time.split(':');
        document.getElementById('edit-time-hour').value = hour;
        document.getElementById('edit-time-minute').value = minute;
    } else {
        // Si no hay hora, dejamos los campos vacíos para que el usuario los rellene.
        document.getElementById('edit-time-hour').value = '';
        document.getElementById('edit-time-minute').value = '';
    }
    
    // Rellenar select de día o campo de fecha
    if (classData.type === 'recurring') {
        form.elements['day'].value = classData.day;
    } else {
        form.elements['date'].value = classData.date;
    }

    // Rellenar select de profesores
    await populateTeacherSelects(classData.teacher, 'edit-teacher-select');
    
    // Configurar botones del footer
    setupModalFooterButtons();

    classModal.show();
}

    async function renderAttendeesList() {
        const attendeesList = document.getElementById('attendees-list');
        const occupancyElement = document.getElementById('modal-class-occupancy');
        
        const classId = parseInt(document.getElementById('class-modal').dataset.classId);
        const classType = document.getElementById('class-modal').dataset.classType;

        // Obtener datos
        const [students, inscriptions, classData] = await Promise.all([
            Student.findAll(),
            classType === 'recurring' ? window.db.getAllRecurringInscriptions() : window.db.getAllInscriptions(),
            classType === 'recurring' ? RecurringClass.findById(classId) : OneOffClass.findById(classId)
        ]);

        // Filtrar inscripciones de esta clase
        const classInscriptions = classType === 'recurring' 
            ? inscriptions.filter(i => i.templateId === classId)
            : inscriptions.filter(i => i.oneOffClassId === classId);

        // Actualizar ocupación
        occupancyElement.textContent = `${classInscriptions.length} / ${classData.capacity} Plazas`;
        occupancyElement.classList.toggle('text-red-500', classInscriptions.length >= classData.capacity);

        // Renderizar lista
        attendeesList.innerHTML = '';
        
        if (classInscriptions.length === 0) {
            attendeesList.appendChild(
                DOMUtils.createElement('p', 'text-gray-500', 'No hay alumnos inscritos.')
            );
            return;
        }

        for (const inscription of classInscriptions) {
            const student = students.find(s => s.id === inscription.studentId);
            if (student) {
                const attendeeDiv = DOMUtils.createElement('div', 
                    'flex justify-between items-center bg-gray-100 p-2 rounded-md'
                );
                
                attendeeDiv.innerHTML = `
                    <p>${student.name}</p>
                    <button data-inscription-id="${inscription.id}" class="remove-attendee-btn text-red-400 hover:text-red-600 font-semibold text-sm">Quitar</button>
                `;

                attendeeDiv.querySelector('.remove-attendee-btn').addEventListener('click', () => 
                    handleRemoveAttendee(inscription.id, classType)
                );

                attendeesList.appendChild(attendeeDiv);
            }
        }
    }

    async function populateStudentSelect() {
        const addStudentSelect = document.getElementById('add-student-select');
        const addStudentBtn = document.getElementById('add-student-to-class-btn');
        
        const classId = parseInt(document.getElementById('class-modal').dataset.classId);
        const classType = document.getElementById('class-modal').dataset.classType;

        // Obtener estudiantes e inscripciones
        const [students, inscriptions] = await Promise.all([
            Student.findAll(),
            classType === 'recurring' ? window.db.getAllRecurringInscriptions() : window.db.getAllInscriptions()
        ]);

        // IDs de estudiantes ya inscritos
        const enrolledIds = classType === 'recurring'
            ? inscriptions.filter(i => i.templateId === classId).map(i => i.studentId)
            : inscriptions.filter(i => i.oneOffClassId === classId).map(i => i.studentId);

        // Estudiantes disponibles
        const availableStudents = students.filter(s => !enrolledIds.includes(s.id));

        // Llenar select
        addStudentSelect.innerHTML = '<option value="">Selecciona un alumno...</option>';
        DataUtils.sortBy(availableStudents, 'name').forEach(student => {
            const option = DOMUtils.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            addStudentSelect.appendChild(option);
        });

        // Event listener para añadir estudiante (remover listener previo)
        const newBtn = addStudentBtn.cloneNode(true);
        addStudentBtn.parentNode.replaceChild(newBtn, addStudentBtn);
        
        newBtn.addEventListener('click', async () => {
            const studentId = parseInt(addStudentSelect.value);
            if (!studentId) {
                NotificationUtils.warning('Por favor, selecciona un alumno');
                return;
            }

            try {
                const classData = classType === 'recurring' 
                    ? await RecurringClass.findById(classId)
                    : await OneOffClass.findById(classId);

                await classData.addStudent(studentId);
                
                NotificationUtils.success('Estudiante añadido a la clase');
                await renderAttendeesList();
                await populateStudentSelect();
                await renderCalendar();
            } catch (error) {
                console.error("Error adding student to class:", error);
                NotificationUtils.error('Error: ' + error.message);
            }
        });
    }

/**
 * Rellena el menú desplegable del filtro de profesores.
 */
    async function populateTeacherFilter() {
        const select = document.getElementById('teacher-filter-select');
        // Guardamos el valor actual por si acaso
        const currentValue = select.value;

        // Limpiamos opciones antiguas, pero dejamos la primera ("Todos")
        select.length = 1;

        const teachers = await Teacher.findAll();
        const sortedTeachers = DataUtils.sortBy(teachers, 'name');

        sortedTeachers.forEach(teacher => {
            const option = DOMUtils.createElement('option');
            option.value = teacher.name;
            option.textContent = teacher.name;
            select.appendChild(option);
        });

        // Restauramos el valor que estaba seleccionado
        select.value = currentValue;
    }

    async function populateTeacherSelects(selectedValue = '', targetSelectId = null) {
        const teachers = await Teacher.findAll();
        const selects = targetSelectId 
            ? [document.getElementById(targetSelectId)]
            : [
                document.getElementById('template-teacher-select'),
                document.getElementById('one-off-teacher-select'),
                document.getElementById('edit-teacher-select') // Añadir el nuevo select
            ];

        selects.forEach(select => {
            if (!select) return;
            
            const currentValue = select.value; // Guardar valor actual si existe
            select.innerHTML = '';
            select.appendChild(new Option('Selecciona profesor/a...', ''));
            
            DataUtils.sortBy(teachers, 'name').forEach(teacher => {
                select.appendChild(new Option(teacher.name, teacher.name));
            });
            
            select.appendChild(new Option('➕ Añadir nuevo/a profesor/a...', 'new-teacher'));
            select.value = selectedValue || currentValue;
        });
    }

    // --- Event Handlers ---
    async function handleDeleteStudent(studentId) {
        if (confirm('¿Estás seguro de que quieres eliminar a este alumno? Se borrarán TODAS sus inscripciones a clases.')) {
            try {
                const student = await Student.findById(studentId);
                if (student) {
                    await student.delete();
                    NotificationUtils.success('Estudiante eliminado correctamente');
                    await renderStudentsTable();
                    await renderCalendar();
                }
            } catch (error) {
                console.error("Error deleting student:", error);
                NotificationUtils.error('Error al eliminar estudiante');
            }
        }
    }


    let editStudentModal; // Declara la variable para el modal de edición

    function setupEditStudentModal() {
        // Inicializa el modal
        editStudentModal = new Modal('edit-student-modal');
        
        const editForm = document.getElementById('edit-student-form');
        const clearFechaBajaBtn = document.getElementById('clear-fecha-baja-btn');

        // Limpiar fecha de baja (reactivar alumno)
        clearFechaBajaBtn.addEventListener('click', () => {
            document.getElementById('edit-student-fecha-baja').value = '';
        });

        // Guardar cambios del formulario de edición
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const studentId = document.getElementById('edit-student-id').value;
            const student = await Student.findById(parseInt(studentId, 10));

            if (student) {
                // Recoger datos del formulario
                student.name = document.getElementById('edit-student-name').value;
                student.email = document.getElementById('edit-student-email').value;
                student.phone = document.getElementById('edit-student-phone').value;
                student.fechaAlta = new Date(document.getElementById('edit-student-fecha-alta').value);
                const fechaBajaValue = document.getElementById('edit-student-fecha-baja').value;
                student.fechaBaja = fechaBajaValue ? new Date(fechaBajaValue) : null;

                try {
                    await student.save();
                    NotificationUtils.success('Alumno actualizado correctamente');
                    editStudentModal.hide();
                    await renderStudentsTable(); // Actualizar la tabla
                } catch (error) {
                    NotificationUtils.error('Error al actualizar: ' + error.message);
                }
            }
        });
    }

    async function handleEditStudent(studentId) {
        const student = await Student.findById(studentId);
        if (student) {
            // Rellenar el formulario del modal con los datos del alumno
            document.getElementById('edit-student-id').value = student.id;
            document.getElementById('edit-student-name').value = student.name;
            document.getElementById('edit-student-email').value = student.email;
            document.getElementById('edit-student-phone').value = student.phone;
            
            if (student.fechaAlta) {
                const date = new Date(student.fechaAlta);
                // Ajustar por la zona horaria para evitar que se muestre el día anterior
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                document.getElementById('edit-student-fecha-alta').value = date.toISOString().split('T')[0];
            }
            // Formatear la fecha de baja para el input (YYYY-MM-DD)
            if (student.fechaBaja) {
                const date = new Date(student.fechaBaja);
                // Ajustar por la zona horaria para evitar que se reste un día
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                document.getElementById('edit-student-fecha-baja').value = date.toISOString().split('T')[0];
            } else {
                document.getElementById('edit-student-fecha-baja').value = '';
            }
            
            editStudentModal.show(); // Mostrar el modal
        }
    }

async function handleDeleteAllStudents() {
    const confirmation1 = confirm("ADVERTENCIA: Estás a punto de borrar a TODOS los alumnos y TODAS sus inscripciones. Esta acción es irreversible. ¿Deseas continuar?");
    
    if (confirmation1) {
        const confirmation2 = confirm("SEGUNDA ADVERTENCIA: Por favor, confirma una vez más que quieres eliminar permanentemente todos los datos de los alumnos.");
        
        if (confirmation2) {
            try {
                await window.db.clearAllStudentsAndRelatedData();
                NotificationUtils.success('Todos los alumnos y sus inscripciones han sido eliminados.');
                
                // --- MODIFICACIÓN CLAVE AQUÍ ---
                // En lugar de refrescar vistas ocultas, te llevamos directamente a la vista de alumnos.
                // Esto hará que el cambio sea visible al instante.
                await switchView('alumnos');

            } catch (error) {
                console.error("Error al eliminar todos los alumnos:", error);
                NotificationUtils.error('Hubo un error durante la eliminación.');
            }
        }
    }
}

    async function handleExportData() {
        try {
            console.log("Iniciando exportación de datos...");
            
            // 1. Recoger todos los datos de la base de datos
            const [students, teachers, scheduleTemplate, oneOffClasses, inscriptions, recurringInscriptions] = await window.db.loadAllData();

            // 2. Crear un objeto que contendrá todos los datos
            const backupData = {
                students: students,
                teachers: teachers,
                scheduleTemplate: scheduleTemplate,
                oneOffClasses: oneOffClasses,
                inscriptions: inscriptions,
                recurringInscriptions: recurringInscriptions,
                exportedAt: new Date().toISOString()
            };

            // 3. Convertir el objeto a un string JSON formateado
            const jsonString = JSON.stringify(backupData, null, 2);

            // 4. Crear un fichero virtual (Blob) y generar una URL para él
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // 5. Crear un enlace temporal, simular un clic para descargar y luego eliminarlo
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            a.download = `nura-yoga-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // 6. Liberar la URL del objeto para limpiar memoria
            URL.revokeObjectURL(url);
            
            NotificationUtils.success('Datos exportados correctamente.');

        } catch (error) {
            console.error("Error durante la exportación:", error);
            NotificationUtils.error('No se pudieron exportar los datos.');
        }
    }

    
    async function handleImportData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);

                // 1. Validar que el fichero parece correcto
                if (!backupData.students || !backupData.teachers || !backupData.scheduleTemplate) {
                    throw new Error("El formato del fichero no es válido.");
                }

                // 2. Pedir confirmación al usuario (¡MUY IMPORTANTE!)
                if (!confirm('¿Estás seguro de que quieres importar estos datos? Se borrarán TODOS los datos actuales de la aplicación.')) {
                    return;
                }

                // 3. Limpiar todas las tablas de la base de datos
                console.log("Limpiando base de datos actual...");
                for (const storeName of Object.values(window.db.STORES)) {
                    await window.db.clear(storeName);
                }

                // 4. Insertar los nuevos datos tabla por tabla
                console.log("Importando nuevos datos...");
                for (const storeName of Object.keys(window.db.STORES)) {
                    if (backupData[storeName]) {
                        for (const item of backupData[storeName]) {
                            // Usamos 'update' (que en realidad es un 'put') para preservar los IDs
                            await window.db.update(storeName, item);
                        }
                    }
                }

                NotificationUtils.success('Datos importados correctamente. Refrescando aplicación...');
                
                // 5. Refrescar la vista
                await switchView('horario');

            } catch (error) {
                console.error("Error durante la importación:", error);
                NotificationUtils.error('Error al importar: ' + error.message);
            } finally {
                // Limpiar el input para poder seleccionar el mismo fichero otra vez
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    }

    async function handleRemoveAttendee(inscriptionId, classType) {
        if (confirm('¿Seguro que quieres quitar a este alumno de la clase?')) {
            try {
                if (classType === 'recurring') {
                    await window.db.deleteRecurringInscription(inscriptionId);
                } else {
                    await window.db.deleteInscription(inscriptionId);
                }
                
                NotificationUtils.success('Alumno eliminado de la clase');
                await renderAttendeesList();
                await populateStudentSelect();
                await renderCalendar();
            } catch (error) {
                console.error("Error removing attendee:", error);
                NotificationUtils.error('Error al quitar alumno de la clase');
            }
        }
    }


    async function handleEditTemplate(templateId) {
    const template = await RecurringClass.findById(templateId);
    if (!template) return;

    // Rellenar formulario (sin la hora)
    templateForm.setData({
        'template-class-id': template.id,
        'template-day': template.day,
        'template-name': template.name,
        'template-capacity': template.capacity
    });

    // Separar y asignar la hora y minutos a los select
    if (template.time) {
        const [hour, minute] = template.time.split(':');
        document.getElementById('template-time-hour').value = hour;
        document.getElementById('template-time-minute').value = minute;
    }

    await populateTeacherSelects(template.teacher);
    
    document.getElementById('template-form-title').textContent = 'Editando Clase Fija';
    document.getElementById('save-template-class-btn').textContent = 'Guardar Cambios';
    }

    async function handleDeleteTemplate(templateId) {
        if (confirm('¿Seguro que quieres eliminar esta clase fija? Se borrarán TODAS sus inscripciones recurrentes.')) {
            try {
                const template = await RecurringClass.findById(templateId);
                if (template) {
                    await template.delete();
                    NotificationUtils.success('Clase fija eliminada correctamente');
                    await renderTemplateEditor();
                    await renderCalendar();
                }
            } catch (error) {
                console.error("Error deleting template:", error);
                NotificationUtils.error('Error al eliminar clase fija');
            }
        }
    }

    async function handleEditOneOffClass(classId) {
    const oneOffClass = await OneOffClass.findById(classId);
    if (!oneOffClass) return;

    // Rellenar formulario (sin la hora)
    oneOffForm.setData({
        'one-off-class-id': oneOffClass.id,
        'one-off-date': oneOffClass.date,
        'one-off-name': oneOffClass.name,
        'one-off-capacity': oneOffClass.capacity
    });

    // Separar y asignar la hora y minutos a los select
    if (oneOffClass.time) {
        const [hour, minute] = oneOffClass.time.split(':');
        document.getElementById('one-off-time-hour').value = hour;
        document.getElementById('one-off-time-minute').value = minute;
    }

    await populateTeacherSelects(oneOffClass.teacher);
    
    document.getElementById('one-off-modal-title').textContent = 'Editando Clase Puntual';
    document.getElementById('save-one-off-class-btn').textContent = 'Guardar Cambios';
    
    classModal.hide();
    oneOffModal.show();
    }

    function populateTimeSelects() {
        const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
        const minutes = ['00', '15', '30', '45'];

        const hourSelects = [
            document.getElementById('template-time-hour'), 
            document.getElementById('one-off-time-hour'),
            document.getElementById('edit-time-hour') // Añadir nuevo select de hora
        ];
        const minuteSelects = [
            document.getElementById('template-time-minute'), 
            document.getElementById('one-off-time-minute'),
            document.getElementById('edit-time-minute') // Añadir nuevo select de minutos
        ];

        hourSelects.forEach(select => {
            if (!select) return;
            select.innerHTML = '';
            hours.forEach(hour => select.add(new Option(hour, hour)));
        });

        minuteSelects.forEach(select => {
            if (!select) return;
            select.innerHTML = '';
            minutes.forEach(minute => select.add(new Option(minute, minute)));
        });
    }


    async function handleDeleteOneOffClass(classId) {
        if (confirm('¿Seguro que quieres eliminar esta clase puntual? Se borrarán también todos los alumnos apuntados a ella.')) {
            try {
                const oneOffClass = await OneOffClass.findById(classId);
                if (oneOffClass) {
                    await oneOffClass.delete();
                    NotificationUtils.success('Clase puntual eliminada correctamente');
                    await renderCalendar();
                    classModal.hide();
                }
            } catch (error) {
                console.error("Error deleting one-off class:", error);
                NotificationUtils.error('Error al eliminar clase puntual');
            }
        }
    }

    async function handleClearAllInscriptions() {
        if (confirm('¿ESTÁS SEGURO? Esta acción borrará TODAS las inscripciones de TODOS los alumnos. No se puede deshacer.')) {
            try {
                await window.db.clearAllInscriptions();
                NotificationUtils.success('Todas las inscripciones han sido eliminadas');
                await renderCalendar();
            } catch (error) {
                console.error("Error clearing inscriptions:", error);
                NotificationUtils.error('Error al limpiar inscripciones');
            }
        }
    }

    // --- Form Reset Functions ---
    function resetTemplateForm() {
        templateForm.clear();
        document.getElementById('template-class-id').value = '';
        document.getElementById('template-form-title').textContent = 'Añadir Nueva Clase Fija';
        document.getElementById('save-template-class-btn').textContent = 'Añadir';
        populateTeacherSelects();
        renderTemplateEditor();
    }

    function resetOneOffForm() {
        oneOffForm.clear();
        document.getElementById('one-off-class-id').value = '';
        document.getElementById('one-off-modal-title').textContent = 'Nueva Clase Puntual';
        document.getElementById('save-one-off-class-btn').textContent = 'Guardar Clase';
        populateTeacherSelects();
    }


async function switchView(viewName) {
    const isHorario = viewName === 'horario';
    const isAlumnos = viewName === 'alumnos';
    const isIngresos = viewName === 'ingresos'; // Añadido
    const isConfiguracion = viewName === 'configuracion';

    // Ocultar todas las vistas
    document.getElementById('view-horario').classList.add('hidden');
    document.getElementById('view-alumnos').classList.add('hidden');
    document.getElementById('view-ingresos').classList.add('hidden'); // Añadido
    document.getElementById('view-configuracion').classList.add('hidden');

    // Resetear bordes de navegación
    document.getElementById('nav-horario').classList.replace('border-white', 'border-transparent');
    document.getElementById('nav-alumnos').classList.replace('border-white', 'border-transparent');
    document.getElementById('nav-ingresos').classList.replace('border-white', 'border-transparent'); // Añadido
    document.getElementById('nav-configuracion').classList.replace('border-white', 'border-transparent');

    if (isHorario) {
        document.getElementById('view-horario').classList.remove('hidden');
        document.getElementById('nav-horario').classList.replace('border-transparent', 'border-white');
        await renderCalendar();
    } else if (isAlumnos) {
        document.getElementById('view-alumnos').classList.remove('hidden');
        document.getElementById('nav-alumnos').classList.replace('border-transparent', 'border-white');
        const students = await Student.findAll();
        await renderStudentStats(students);
        await renderStudentsTable('', students);
    } else if (isIngresos) { // NUEVO BLOQUE LÓGICO
        document.getElementById('view-ingresos').classList.remove('hidden');
        document.getElementById('nav-ingresos').classList.replace('border-transparent', 'border-white');
        await renderIngresosView(); // Llamamos a la nueva función
    } else if (isConfiguracion) {
        document.getElementById('view-configuracion').classList.remove('hidden');
        document.getElementById('nav-configuracion').classList.replace('border-transparent', 'border-white');
    }
}

async function renderStudentStats(students = null) {
    document.getElementById('stat-total-students').textContent = '-';
    document.getElementById('stat-paid-students').textContent = '-';
    document.getElementById('stat-attending-one-class').textContent = '-';
    document.getElementById('stat-attending-multiple-classes').textContent = '-';

    // Si no nos pasan la lista de alumnos, la buscamos (mantiene la compatibilidad)
    if (students === null) {
        students = await Student.findAll();
    }
    
    const totalStudents = students.length;

    const currentMonthKey = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const paidStudents = students.filter(s => s.getPaymentDateForMonth(currentMonthKey)).length;

    const [inscriptions, recurringInscriptions] = await Promise.all([
        window.db.getAllInscriptions(),
        window.db.getAllRecurringInscriptions()
    ]);

    const inscriptionCounts = {};
    const allStudentIdsWithInscriptions = [
        ...inscriptions.map(i => i.studentId),
        ...recurringInscriptions.map(i => i.studentId)
    ];

    allStudentIdsWithInscriptions.forEach(id => {
        inscriptionCounts[id] = (inscriptionCounts[id] || 0) + 1;
    });

    const attendingOneOrMore = Object.keys(inscriptionCounts).length;
    const attendingMultiple = Object.values(inscriptionCounts).filter(count => count > 1).length;

    document.getElementById('stat-total-students').textContent = totalStudents;
    document.getElementById('stat-paid-students').textContent = paidStudents;
    document.getElementById('stat-attending-one-class').textContent = attendingOneOrMore;
    document.getElementById('stat-attending-multiple-classes').textContent = attendingMultiple;
}

/**
 * Calcula los ingresos teóricos y reales, mensuales y anuales.
 * @returns {Promise<object>} Un objeto con los totales calculados.
 */
async function calculateIncome() {
    const students = await Student.findAll();
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthKey = `${currentYear}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    let theoreticalMonthly = 0;
    let realMonthly = 0;
    let realAnnual = 0;

    for (const student of students) {
        // Solo contamos alumnos activos para los ingresos teóricos
        if (student.fechaBaja && student.fechaBaja < today) {
            continue; // Saltamos los alumnos que ya se han dado de baja
        }

        const classes = await student.getActiveClasses();
        const recurringClassesCount = classes.recurring.length;
        let price = 0;

        // --- LÓGICA DE PRECIOS ---
        // Asumimos que una clase "Pilates express" contiene esas palabras en su nombre.
        const hasPilatesExpress = classes.recurring.some(c => 
            c.name.trim().toUpperCase() === "PILATES EXPRESS '45'"
        );

        if (recurringClassesCount === 1) {
            price = hasPilatesExpress ? 30 : 35;
        } else if (recurringClassesCount === 2) {
            // Regla: 2 días pero con Pilates express + 1 normal
            if (hasPilatesExpress) {
                price = 50;
            } else {
                price = 55;
            }
        }
        
        // Sumamos al total teórico mensual si el alumno tiene alguna clase asignada
        if (price > 0) {
            theoreticalMonthly += price;
        }

        // --- CÁLCULO DE INGRESOS REALES ---
        // Ingreso real del mes actual
        if (student.getPaymentDateForMonth(currentMonthKey)) {
            realMonthly += price;
        }
        
        // Ingreso real de todo el año
        for (let i = 1; i <= 12; i++) {
            const monthKey = `${currentYear}-${i.toString().padStart(2, '0')}`;
            if (student.getPaymentDateForMonth(monthKey)) {
                // Para el anual, necesitamos recalcular el precio que tenía ESE MES.
                // Esta es una simplificación: asumimos que el precio actual se aplica a todo el año.
                // Una versión avanzada guardaría el precio en el historial de pagos.
                realAnnual += price;
            }
        }
    }

    const theoreticalAnnual = theoreticalMonthly * 12;

    return {
        theoreticalMonthly,
        realMonthly,
        theoreticalAnnual,
        realAnnual
    };
}

/**
 * Obtiene los datos de ingresos y los muestra en la vista.
 */
async function renderIngresosView() {
    // Mostrar un estado de carga mientras se calcula
    const formatCurrency = (amount) => new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0, // No mostrar decimales
        maximumFractionDigits: 0  // Redondear al entero más cercano
    }).format(amount);
        
    document.getElementById('ingresos-mes-teorico').textContent = 'Calculando...';
    document.getElementById('ingresos-mes-real').textContent = 'Calculando...';
    document.getElementById('ingresos-ano-teorico').textContent = 'Calculando...';
    document.getElementById('ingresos-ano-real').textContent = 'Calculando...';

    const income = await calculateIncome();

    // Actualizar la UI con los valores calculados
    document.getElementById('ingresos-mes-teorico').textContent = formatCurrency(income.theoreticalMonthly);
    document.getElementById('ingresos-mes-real').textContent = formatCurrency(income.realMonthly);
    document.getElementById('ingresos-ano-teorico').textContent = formatCurrency(income.theoreticalAnnual);
    document.getElementById('ingresos-ano-real').textContent = formatCurrency(income.realAnnual);
}





// app.js -> Reemplaza la función entera con esta versión final

async function handleSaveChangesFromClassModal() {
    console.log(`[${new Date().toLocaleTimeString()}] Se inicia el guardado de cambios.`);

    const modal = document.getElementById('class-modal');
    const classId = parseInt(modal.dataset.classId);
    const classType = modal.dataset.classType;
    
    try {
        const form = document.getElementById('edit-class-form');
        const hour = document.getElementById('edit-time-hour').value;
        const minute = document.getElementById('edit-time-minute').value;

        // --- INICIO DE LA NUEVA VERIFICACIÓN ---
        // Si la hora o los minutos están vacíos, no continuamos.
        if (!hour || !minute) {
            NotificationUtils.error('Por favor, selecciona una hora y minutos válidos.');
            console.error('VALIDACIÓN FALLIDA: La hora o los minutos están vacíos.', { hour, minute });
            return; // Detiene la ejecución aquí mismo.
        }
        // --- FIN DE LA NUEVA VERIFICACIÓN ---

        const combinedTime = `${hour}:${minute}`;

        const classDetails = {
            name: form.elements['name'].value,
            teacher: form.elements['teacher'].value,
            capacity: parseInt(form.elements['capacity'].value),
            time: combinedTime
        };

        let classInstance;
        if (classType === 'recurring') {
            classDetails.day = parseInt(form.elements['day'].value);
            classInstance = await RecurringClass.findById(classId);
        } else {
            classDetails.date = form.elements['date'].value;
            classInstance = await OneOffClass.findById(classId);
        }
        
        if (classInstance) {
            Object.assign(classInstance, classDetails);
            await classInstance.save();
            
            console.log('ÉXITO: La clase se ha guardado correctamente en la BD.');
            NotificationUtils.success('Clase actualizada correctamente');
            
            classModal.hide();
            await renderCalendar();
        }
    } catch (error) {
        console.error('ERROR CAPTURADO: Ha fallado el guardado.', error);
        NotificationUtils.error('Error al guardar: ' + error.message);
    }
}

function setupModalFooterButtons() {
    const modal = document.getElementById('class-modal');
    const classId = parseInt(modal.dataset.classId);
    const classType = modal.dataset.classType;

    const saveBtn = document.getElementById('save-class-changes-btn');
    const deleteBtn = document.getElementById('delete-class-btn');

    // Asignamos la función directamente al evento 'onclick'.
    // Esto garantiza que siempre habrá un único listener, reemplazando cualquier anterior.
    saveBtn.onclick = () => handleSaveChangesFromClassModal();

    deleteBtn.onclick = () => {
        if (classType === 'recurring') {
            handleDeleteTemplate(classId);
        } else {
            handleDeleteOneOffClass(classId);
        }
    };
}

async function showStudentDetails(studentId) {
    const student = await Student.findById(studentId);
    if (!student) {
        console.error("No se encontró al alumno");
        return;
    }

    const classes = await student.getActiveClasses();
    
    // Rellenar cabecera del modal
    document.getElementById('student-details-name').textContent = student.name;
    
    // --- Rellenar Panel de Detalles Personales ---
    document.getElementById('details-student-email').textContent = student.email || '-';
    document.getElementById('details-student-phone').textContent = student.phone || '-';
    document.getElementById('details-student-alta').textContent = new Date(student.fechaAlta).toLocaleDateString('es-ES');

    const estadoElement = document.getElementById('details-student-estado');
    if (student.fechaBaja) {
        const fechaBajaFormatted = new Date(student.fechaBaja).toLocaleDateString('es-ES');
        estadoElement.innerHTML = `<span class="font-semibold text-red-500">De baja (${fechaBajaFormatted})</span>`;
    } else {
        estadoElement.innerHTML = '<span class="font-semibold text-green-600">Activo</span>';
    }

    // --- Rellenar Listas de Clases ---
    const recurringList = document.getElementById('student-recurring-classes-list');
    const oneOffList = document.getElementById('student-one-off-classes-list');
    
    recurringList.innerHTML = '';
    oneOffList.innerHTML = '';

    if (classes.recurring.length > 0) {
        classes.recurring.forEach(clase => {
            const dayName = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][clase.day - 1];
            const item = DOMUtils.createElement('div', 'bg-gray-100 p-2 rounded');
            item.innerHTML = `<p class="font-semibold">${clase.name}</p><p class="text-sm text-gray-600">${dayName} a las ${clase.time}</p>`;
            recurringList.appendChild(item);
        });
    } else {
        recurringList.innerHTML = '<p class="text-gray-500">No está inscrito/a en ninguna clase fija.</p>';
    }

    if (classes.oneOff.length > 0) {
        classes.oneOff.forEach(clase => {
            const dateFormatted = new Date(clase.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
            const item = DOMUtils.createElement('div', 'bg-gray-100 p-2 rounded');
            item.innerHTML = `<p class="font-semibold">${clase.name}</p><p class="text-sm text-gray-600">${dateFormatted} a las ${clase.time}</p>`;
            oneOffList.appendChild(item);
        });
    } else {
        oneOffList.innerHTML = '<p class="text-gray-500">No está inscrito/a en ninguna clase puntual.</p>';
    }

    // --- INICIO: NUEVA LÓGICA DE PAGOS ---
    const paymentContainer = document.getElementById('student-payment-history');
    paymentContainer.innerHTML = ''; // Limpiar contenido previo

    const startDate = new Date(student.fechaAlta);
    const endDate = new Date();
    let currentDateIterator = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (currentDateIterator <= endDate) {
        const year = currentDateIterator.getFullYear();
        const month = currentDateIterator.getMonth() + 1;
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        const monthName = currentDateIterator.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        
        const paymentDate = student.getPaymentDateForMonth(monthKey);
        
        const paymentRow = DOMUtils.createElement('div', 'flex justify-between items-center bg-gray-100 p-2 rounded');
        
        let statusHTML;
        let buttonHTML;

        if (paymentDate) {
            const formattedDate = new Date(paymentDate).toLocaleDateString('es-ES');
            statusHTML = `<span class="text-sm text-green-700">Pagado</span>`;
            buttonHTML = `<button data-month-key="${monthKey}" class="toggle-payment-btn text-xs font-semibold text-gray-500 hover:text-red-500">Deshacer</button>`;
        } else {
            statusHTML = `<span class="text-sm font-semibold text-red-600">Pendiente</span>`;
            buttonHTML = `<button data-month-key="${monthKey}" class="toggle-payment-btn text-xs font-semibold text-white bg-green-500 hover:bg-green-600 px-2 py-1 rounded">Marcar Pagado</button>`;
        }

        paymentRow.innerHTML = `
            <div>
                <p class="font-semibold capitalize">${monthName}</p>
                ${statusHTML}
            </div>
            ${buttonHTML}
        `;
        
        paymentContainer.appendChild(paymentRow);
        currentDateIterator.setMonth(currentDateIterator.getMonth() + 1);
    }

    // Usamos delegación de eventos para manejar los clics en los botones de pago
    paymentContainer.onclick = async (event) => {
        const target = event.target;
        if (target && target.classList.contains('toggle-payment-btn')) {
            const monthKey = target.dataset.monthKey;
            if (monthKey) {
                await student.togglePaymentForMonth(monthKey);
                // Refrescar el modal para ver el cambio inmediatamente
                await showStudentDetails(studentId);
                // Refrescar en segundo plano la tabla principal y las estadísticas
                await renderStudentsTable();
                await renderStudentStats();
            }
        }
    };
    // --- FIN: NUEVA LÓGICA DE PAGOS ---

    studentDetailsModal.show();
}

async function checkAndResetPayments() {
    const today = new Date();
    // Formato "YYYY-MM", por ejemplo "2025-09"
    const currentMonthKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const lastResetMonth = localStorage.getItem('lastPaymentResetMonth');

    // Si el mes actual es diferente al último mes reseteado
    if (currentMonthKey !== lastResetMonth) {
        console.log(`Nuevo mes detectado (${currentMonthKey}). Inicializando estados de pago.`);
        
        const students = await Student.findAll();
        const updatePromises = [];

        for (const student of students) {
            // Si el alumno no tiene una entrada para el mes actual, se la creamos como 'null' (No pagado)
            if (student.payments[currentMonthKey] === undefined) {
                student.payments[currentMonthKey] = null; // Cambiado de 'false' a 'null'
                updatePromises.push(student.save());
            }
        }

        await Promise.all(updatePromises);
        
        // Actualizamos el localStorage para no volver a hacerlo este mes
        localStorage.setItem('lastPaymentResetMonth', currentMonthKey);
        console.log("Estados de pago inicializados.");
    }
}

async function handleTogglePayment(studentId) {
    const student = await Student.findById(studentId);
    if (!student) return;

    try {
        const currentMonthKey = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        await student.togglePaymentForMonth(currentMonthKey);
        
        // Mantenemos esto para que las estadísticas de arriba se actualicen
        await renderStudentStats(); 
        
        // CAMBIO CLAVE: Usamos la nueva función que no mueve el scroll
        await updateStudentRow(studentId);

    } catch (error) {
        console.error("Error al cambiar el estado de pago:", error);
        NotificationUtils.error('No se pudo actualizar el pago.');
    }
}

    // --- Initialize Application ---
    await initializeApp();
});