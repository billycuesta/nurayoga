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
    
    // --- UI Components ---
    let classModal, studentModal, templateModal, oneOffModal;
    let studentForm, templateForm, oneOffForm;
    let studentsTable, calendar;

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

            // Configurar componentes UI
            setupUIComponents();
            setupEventListeners();
            setupFormValidators();
            populateTimeSelects();


            document.getElementById('export-data-btn').addEventListener('click', handleExportData);
            
            const importInput = document.getElementById('import-data-input');
            document.getElementById('import-data-btn').addEventListener('click', () => {
                importInput.click(); // Abrir el diálogo de selección de archivo
            });
            importInput.addEventListener('change', handleImportData);


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
    navHorario.addEventListener('click', () => switchView('horario'));
    navAlumnos.addEventListener('click', () => switchView('alumnos'));
    document.getElementById('nav-configuracion').addEventListener('click', () => switchView('configuracion'));


    // Navegación semanal
    prevWeekBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderCalendar();
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderCalendar();
    });

    // Botones para abrir modales
    document.getElementById('open-new-student-modal').addEventListener('click', () => {
        studentModal.show();
    });

    document.getElementById('open-template-modal-btn').addEventListener('click', () => {
        resetTemplateForm();
        templateModal.show();
    });

    document.getElementById('open-one-off-class-modal-btn').addEventListener('click', () => {
        resetOneOffForm();
        oneOffModal.show();
    });

    // Búsqueda de estudiantes
    document.getElementById('student-search-input').addEventListener('input', (e) => {
        renderStudentsTable(e.target.value);
    });

    // Limpiar inscripciones
    document.getElementById('clear-all-inscriptions-btn').addEventListener('click', 
        handleClearAllInscriptions
    );

    // --- Definición de la función que configura los formularios ---
    // Esta función anidada contiene toda la lógica para guardar los formularios
    function setupFormSubmissions() {
        // Formulario de estudiante
        studentForm.onSubmit(async (data) => {
            try {
                const student = new Student({
                    name: data['new-student-name'],
                    email: data['new-student-email'],
                    phone: data['new-student-phone']
                });
                await student.save();
                
                NotificationUtils.success('Estudiante creado correctamente');
                studentModal.hide();
                await renderStudentsTable();
            } catch (error) {
                console.error("Error creating student:", error);
                NotificationUtils.error('Error al crear estudiante: ' + error.message);
            }
        });
    
        // Formulario de clase template
        templateForm.onSubmit(async (data) => {
            try {
                const classId = document.getElementById('template-class-id').value;
                
                const hour = document.getElementById('template-time-hour').value;
                const minute = document.getElementById('template-time-minute').value;
                const combinedTime = `${hour}:${minute}`;
    
                const classDetails = {
                    day: parseInt(data['template-day']),
                    time: combinedTime,
                    name: data['template-name'],
                    teacher: data['template-teacher-select'],
                    capacity: parseInt(data['template-capacity'])
                };
                
                let recurringClass;
                if (classId) {
                    recurringClass = await RecurringClass.findById(parseInt(classId));
                    if (recurringClass) {
                        Object.assign(recurringClass, classDetails);
                    }
                } else {
                    recurringClass = new RecurringClass(classDetails);
                }
    
                await recurringClass.save();
                
                NotificationUtils.success('Clase guardada correctamente');
                await renderTemplateEditor();
                await renderCalendar();
                resetTemplateForm();
            } catch (error) {
                console.error("Error saving template class:", error);
                NotificationUtils.error('Error al guardar clase: ' + error.message);
            }
        });
    
        // Formulario de clase puntual
        oneOffForm.onSubmit(async (data) => {
            try {
                const classId = document.getElementById('one-off-class-id').value;

                const hour = document.getElementById('one-off-time-hour').value;
                const minute = document.getElementById('one-off-time-minute').value;
                const combinedTime = `${hour}:${minute}`;
    
                const classDetails = {
                    date: data['one-off-date'],
                    time: combinedTime,
                    name: data['one-off-name'],
                    teacher: data['one-off-teacher-select'],
                    capacity: parseInt(data['one-off-capacity'])
                };
    
                let oneOffClass;
                if (classId) {
                    oneOffClass = await OneOffClass.findById(parseInt(classId));
                    if (oneOffClass) {
                        Object.assign(oneOffClass, classDetails);
                    }
                } else {
                    oneOffClass = new OneOffClass(classDetails);
                }
    
                await oneOffClass.save();
                
                NotificationUtils.success('Clase puntual guardada correctamente');
                await renderCalendar();
                oneOffModal.hide();
                resetOneOffForm();
            } catch (error) {
                console.error("Error saving one-off class:", error);
                NotificationUtils.error('Error al guardar clase: ' + error.message);
            }
        });
    }
    
    // Selects de profesores
    setupTeacherSelects();

    // --- Llamada a la función que configura los formularios ---
    // Esta es la línea que faltaba para que los botones "Añadir" y "Guardar" funcionen.
    setupFormSubmissions(); 
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
        
        const startOfWeek = DateUtils.getStartOfWeek(currentDate);
        currentWeekDisplay.textContent = `Semana del ${startOfWeek.toLocaleDateString('es-ES', {day: 'numeric', month: 'long'})}`;

        const weekDays = DateUtils.getWeekdayNames();
        
        // Obtener datos
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
            
            // Filtrar clases del día
            const dayRecurringClasses = recurringClasses.filter(c => c.day === i + 1);
            const dayOneOffClasses = oneOffClasses.filter(c => c.date === dayDateString);
            
            const allClasses = [
                ...dayRecurringClasses.map(c => ({ ...c, type: 'recurring' })),
                ...dayOneOffClasses.map(c => ({ ...c, type: 'one-off' }))
            ].sort((a, b) => a.time.localeCompare(b.time));

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
                    
                    // Añadir data attributes
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

    async function renderStudentsTable(filter = '') {
        // Usar el tbody existente en lugar de crear una tabla nueva
        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '';
        
        const students = await Student.findAll();
        const filteredStudents = filter ? SearchUtils.filterStudents(students, filter) : students;
        
        if (filteredStudents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-gray-500">No se encontraron alumnos.</td></tr>';
            return;
        }

        filteredStudents.forEach(student => {
            const row = DOMUtils.createElement('tr', 'border-b hover:bg-gray-50');
            row.innerHTML = `
                <td class="p-4">${student.name}</td>
                <td class="p-4">${student.email || '-'}</td>
                <td class="p-4">${student.phone || '-'}</td>
                <td class="p-4">
                    <button data-id="${student.id}" class="delete-student-btn text-red-500 hover:text-red-700 font-semibold">Eliminar</button>
                </td>
            `;
            
            // Añadir event listener al botón de eliminar
            row.querySelector('.delete-student-btn').addEventListener('click', () => 
                handleDeleteStudent(student.id)
            );
            
            tbody.appendChild(row);
        });
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
        
        // Rellenar selects de hora/minutos
        if (classData.time) {
            const [hour, minute] = classData.time.split(':');
            document.getElementById('edit-time-hour').value = hour;
            document.getElementById('edit-time-minute').value = minute;
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

    // --- View Management ---

    async function switchView(viewName) {
        const isHorario = viewName === 'horario';
        const isAlumnos = viewName === 'alumnos';
        const isConfiguracion = viewName === 'configuracion';
        
        // Ocultar todas las vistas
        viewHorario.classList.add('hidden');
        viewAlumnos.classList.add('hidden');
        document.getElementById('view-configuracion').classList.add('hidden');
        
        // Actualizar estilo de todos los botones de navegación
        navHorario.classList.replace('border-white', 'border-transparent');
        navAlumnos.classList.replace('border-white', 'border-transparent');
        document.getElementById('nav-configuracion').classList.replace('border-white', 'border-transparent');

        // Mostrar la vista y activar el botón seleccionado
        if (isHorario) {
            viewHorario.classList.remove('hidden');
            navHorario.classList.replace('border-transparent', 'border-white');
            await renderCalendar();
        } else if (isAlumnos) {
            viewAlumnos.classList.remove('hidden');
            navAlumnos.classList.replace('border-transparent', 'border-white');
            await renderStudentsTable();
        } else if (isConfiguracion) {
            document.getElementById('view-configuracion').classList.remove('hidden');
            document.getElementById('nav-configuracion').classList.replace('border-transparent', 'border-white');
        }
    }


    // AÑADE ESTA NUEVA FUNCIÓN
async function handleSaveChangesFromClassModal() {
    const modal = document.getElementById('class-modal');
    const classId = parseInt(modal.dataset.classId);
    const classType = modal.dataset.classType;
    
    try {
        const form = document.getElementById('edit-class-form');
        const hour = document.getElementById('edit-time-hour').value;
        const minute = document.getElementById('edit-time-minute').value;
        
        const classDetails = {
            name: form.elements['name'].value,
            teacher: form.elements['teacher'].value,
            capacity: parseInt(form.elements['capacity'].value),
            time: `${hour}:${minute}`
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
            NotificationUtils.success('Clase actualizada correctamente');
            classModal.hide();
            await renderCalendar();
        }
    } catch (error) {
        console.error('Error guardando cambios de la clase:', error);
        NotificationUtils.error('Error al guardar: ' + error.message);
    }
}

    function setupModalFooterButtons() {
        const modal = document.getElementById('class-modal');
        const classId = parseInt(modal.dataset.classId);
        const classType = modal.dataset.classType;

        // Botón Guardar (reemplazamos listener para evitar duplicados)
        const saveBtn = document.getElementById('save-class-changes-btn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', handleSaveChangesFromClassModal);

        // Botón Eliminar (reemplazamos listener)
        const deleteBtn = document.getElementById('delete-class-btn');
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.addEventListener('click', () => {
            if (classType === 'recurring') {
                handleDeleteTemplate(classId);
            } else {
                handleDeleteOneOffClass(classId);
            }
        });
    }

    // --- Initialize Application ---
    await initializeApp();
});