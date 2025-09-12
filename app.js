// --- PWA SERVICE WORKER REGISTRATION ---
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


document.addEventListener('DOMContentLoaded', () => {

    // --- SIMULACIÓN DE BASE DE DATOS (ahora usando localStorage para persistencia) ---
    const getDB = (key) => JSON.parse(localStorage.getItem(key)) || [];
    const setDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));

    let students = [];
    let classes = [];
    let registrations = [];

    const initializeDB = () => {
        if (!localStorage.getItem('students')) {
             const initialStudents = [
                { id: 1, name: 'Ana García Pérez', email: 'ana.g@email.com', phone: '600111222' },
                { id: 2, name: 'David López Ruiz', email: 'david.lr@email.com', phone: '622333444' },
                { id: 3, name: 'María Fernández Soler', email: 'maria.fs@email.com', phone: '633444555' },
                { id: 4, name: 'Carlos Vidal Mas', email: 'carlos.vm@email.com', phone: '611222333' },
                { id: 5, name: 'Lucía Jiménez Sanz', email: 'lucia.js@email.com', phone: '644555666' },
                { id: 6, name: 'Javier Moreno Gil', email: 'javier.mg@email.com', phone: '655666777' },
            ];
            setDB('students', initialStudents);
        }

        if (!localStorage.getItem('classes')) {
            const initialClasses = [
                { id: 101, name: 'Hatha Yoga', time: '09:00', day: 1, capacity: 12 },
                { id: 102, name: 'Vinyasa Flow', time: '18:30', day: 1, capacity: 12 },
                { id: 201, name: 'Vinyasa Flow', time: '09:00', day: 2, capacity: 10 },
                { id: 301, name: 'Hatha Yoga', time: '09:00', day: 3, capacity: 12 },
                { id: 302, name: 'Yin Yoga', time: '18:30', day: 3, capacity: 10 },
                { id: 401, name: 'Yoga Suave', time: '18:00', day: 4, capacity: 10 },
                { id: 501, name: 'Vinyasa Flow', time: '09:00', day: 5, capacity: 10 },
                { id: 502, name: 'Meditación', time: '18:00', day: 5, capacity: 15 },
            ];
            setDB('classes', initialClasses);
        }
        
        if (!localStorage.getItem('registrations')) {
            // Pre-llenar algunas inscripciones para demostración
            const demoWeek = getWeekDays(0);
            const toYYYYMMDD = (date) => date.toISOString().split('T')[0];
            const initialRegistrations = [
                {studentId: 1, classId: 101, dateString: toYYYYMMDD(demoWeek[0])},
                {studentId: 2, classId: 101, dateString: toYYYYMMDD(demoWeek[0])},
                {studentId: 3, classId: 102, dateString: toYYYYMMDD(demoWeek[0])},
                {studentId: 4, classId: 201, dateString: toYYYYMMDD(demoWeek[1])},
                {studentId: 5, classId: 201, dateString: toYYYYMMDD(demoWeek[1])},
                {studentId: 6, classId: 201, dateString: toYYYYMMDD(demoWeek[1])},
                {studentId: 1, classId: 302, dateString: toYYYYMMDD(demoWeek[2])},
                {studentId: 3, classId: 501, dateString: toYYYYMMDD(demoWeek[4])},
            ];
            setDB('registrations', initialRegistrations);
        }

        students = getDB('students');
        classes = getDB('classes');
        registrations = getDB('registrations');
    };
    
    // --- ESTADO DE LA APLICACIÓN ---
    let currentView = 'horario'; // 'horario' o 'alumnos'
    let currentWeekOffset = 0;
    let selectedClassInfo = { id: null, date: null };
    
    // --- ELEMENTOS DEL DOM ---
    const calendarGrid = document.getElementById('calendar-grid');
    const studentsTableBody = document.getElementById('students-table-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const classModal = document.getElementById('class-modal');
    const modalClassName = document.getElementById('modal-class-name');
    const modalClassTime = document.getElementById('modal-class-time');
    const modalClassOccupancy = document.getElementById('modal-class-occupancy');
    const attendeesList = document.getElementById('attendees-list');
    const addStudentSelect = document.getElementById('add-student-select');
    const addAttendeeSection = document.getElementById('add-attendee-section');
    const newStudentModal = document.getElementById('new-student-modal');
    const newStudentForm = document.getElementById('new-student-form');
    
    // --- LÓGICA DE FECHAS ---
    const getWeekDays = (offset) => {
        const now = new Date();
        now.setDate(now.getDate() + offset * 7);
        const today = now.getDay();
        const diff = now.getDate() - today + (today === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        const week = [];
        for (let i = 0; i < 5; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            week.push(day);
        }
        return week;
    };
    
    const formatDate = (date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const toYYYYMMDD = (date) => date.toISOString().split('T')[0];

    // --- FUNCIONES DE RENDERIZADO ---
    const renderCalendar = () => {
        calendarGrid.innerHTML = '';
        const week = getWeekDays(currentWeekOffset);
        
        const firstDay = week[0];
        const lastDay = week[week.length - 1];
        currentWeekDisplay.textContent = `${formatDate(firstDay)} - ${formatDate(lastDay)}`;

        const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        
        daysOfWeek.forEach((dayName, index) => {
            const dayDate = week[index];
            const dateStr = toYYYYMMDD(dayDate);

            const dayCol = document.createElement('div');
            dayCol.innerHTML = `<h3 class="text-xl font-bold text-center mb-4 text-gray-600">${dayName} <span class="text-sm font-normal text-gray-400">${formatDate(dayDate)}</span></h3>`;
            
            const classesForDay = classes.filter(c => c.day === index + 1).sort((a,b) => a.time.localeCompare(b.time));
            
            const classesContainer = document.createElement('div');
            classesContainer.className = "space-y-4";
            
            classesForDay.forEach(c => {
                const registrationsForClass = registrations.filter(r => r.classId === c.id && r.dateString === dateStr);
                const occupancy = registrationsForClass.length;
                const isFull = occupancy >= c.capacity;

                const card = document.createElement('div');
                card.className = `class-card p-4 rounded-lg shadow-md cursor-pointer ${isFull ? 'bg-amber-100 border-l-4 border-amber-500' : 'bg-white'}`;
                card.dataset.classId = c.id;
                card.dataset.date = dateStr;

                card.innerHTML = `
                    <p class="font-bold text-lg text-gray-800">${c.name}</p>
                    <p class="text-gray-500 mb-2">${c.time}</p>
                    <div class="flex justify-between items-center">
                        <p class="text-sm font-semibold ${isFull ? 'text-amber-700' : 'text-gray-600'}">${occupancy}/${c.capacity} Plazas</p>
                        ${isFull ? '<span class="text-xs font-bold text-amber-600 uppercase">COMPLETA</span>' : ''}
                    </div>
                `;
                card.addEventListener('click', () => openClassModal(c.id, dateStr));
                classesContainer.appendChild(card);
            });
            dayCol.appendChild(classesContainer);
            calendarGrid.appendChild(dayCol);
        });
    };

    const renderStudents = (filter = '') => {
        studentsTableBody.innerHTML = '';
        const filteredStudents = students.filter(s => 
            s.name.toLowerCase().includes(filter.toLowerCase()) || 
            s.email.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredStudents.length === 0) {
             studentsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">No se encontraron alumnos.</td></tr>`;
             return;
        }

        filteredStudents.forEach(s => {
            const row = document.createElement('tr');
            row.className = "border-b hover:bg-gray-50";
            row.innerHTML = `
                <td class="p-4">${s.name}</td>
                <td class="p-4 text-gray-600">${s.email}</td>
                <td class="p-4 text-gray-600">${s.phone || '-'}</td>
                <td class="p-4">
                    <button data-student-id="${s.id}" class="remove-student-btn text-red-500 hover:text-red-700 text-sm font-semibold">Eliminar</button>
                </td>
            `;
            row.querySelector('.remove-student-btn').addEventListener('click', (e) => {
                const studentId = parseInt(e.target.dataset.studentId);
                if(confirm('¿Seguro que quieres eliminar a este alumno? Se eliminarán todas sus inscripciones.')) {
                    removeStudent(studentId);
                }
            });
            studentsTableBody.appendChild(row);
        });
    };

    // --- FUNCIONES DE LÓGICA ---
    const switchView = (view) => {
        currentView = view;
        const viewHorario = document.getElementById('view-horario');
        const viewAlumnos = document.getElementById('view-alumnos');
        const navHorario = document.getElementById('nav-horario');
        const navAlumnos = document.getElementById('nav-alumnos');

        if (view === 'horario') {
            viewHorario.classList.remove('hidden');
            viewAlumnos.classList.add('hidden');
            navHorario.classList.add('border-white');
            navHorario.classList.remove('border-transparent');
            navAlumnos.classList.remove('border-white');
            navAlumnos.classList.add('border-transparent');
            renderCalendar();
        } else {
            viewHorario.classList.add('hidden');
            viewAlumnos.classList.remove('hidden');
            navAlumnos.classList.add('border-white');
            navAlumnos.classList.remove('border-transparent');
            navHorario.classList.remove('border-white');
            navHorario.classList.add('border-transparent');
            renderStudents();
        }
    };

    const openClassModal = (classId, dateStr) => {
        selectedClassInfo = { id: classId, date: dateStr };
        const cls = classes.find(c => c.id === classId);
        const date = new Date(dateStr + 'T00:00:00');

        modalClassName.textContent = cls.name;
        modalClassTime.textContent = `${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${cls.time}`;

        renderAttendees(classId, dateStr);
        classModal.classList.remove('hidden');
        classModal.classList.add('flex');
    };

    const closeClassModal = () => {
        classModal.classList.add('hidden');
        classModal.classList.remove('flex');
        selectedClassInfo = { id: null, date: null };
    };

    const renderAttendees = (classId, dateStr) => {
        const registrationsForClass = registrations.filter(r => r.classId === classId && r.dateString === dateStr);
        const attendeeIds = registrationsForClass.map(r => r.studentId);
        const cls = classes.find(c => c.id === classId);

        modalClassOccupancy.textContent = `${attendeeIds.length} / ${cls.capacity} Plazas`;
        if(attendeeIds.length >= cls.capacity) {
            modalClassOccupancy.classList.add('text-red-600');
            addAttendeeSection.classList.add('hidden');
        } else {
             modalClassOccupancy.classList.remove('text-red-600');
             addAttendeeSection.classList.remove('hidden');
        }

        attendeesList.innerHTML = '';
        if(attendeeIds.length === 0) {
            attendeesList.innerHTML = `<p class="text-gray-500">No hay alumnos apuntados.</p>`;
        } else {
            attendeeIds.forEach(id => {
                const student = students.find(s => s.id === id);
                const item = document.createElement('div');
                item.className = "flex justify-between items-center bg-gray-50 p-3 rounded-lg";
                item.innerHTML = `
                    <div>
                        <p class="font-semibold">${student.name}</p>
                        <p class="text-sm text-gray-500">${student.email}</p>
                    </div>
                    <button data-student-id="${student.id}" class="remove-attendee-btn text-gray-400 hover:text-red-600 p-1 rounded-full">&times;</button>
                `;
                item.querySelector('.remove-attendee-btn').addEventListener('click', () => {
                    removeStudentFromClass(student.id, classId, dateStr);
                });
                attendeesList.appendChild(item);
            });
        }

        addStudentSelect.innerHTML = '<option value="">Selecciona un alumno...</option>';
        const availableStudents = students.filter(s => !attendeeIds.includes(s.id));
        availableStudents.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            addStudentSelect.appendChild(option);
        });
    };
    
    const addStudentToClass = () => {
        const studentId = parseInt(addStudentSelect.value);
        if (!studentId || !selectedClassInfo.id) return;

        const { id: classId, date: dateStr } = selectedClassInfo;
        
        const exists = registrations.some(r => r.studentId === studentId && r.classId === classId && r.dateString === dateStr);
        if(exists) {
            alert('Este alumno ya está inscrito en la clase.');
            return;
        }
        
        registrations.push({ studentId, classId, dateString: dateStr });
        setDB('registrations', registrations);
        renderAttendees(classId, dateStr);
        renderCalendar();
    };

    const removeStudentFromClass = (studentId, classId, dateStr) => {
         registrations = registrations.filter(r => !(r.studentId === studentId && r.classId === classId && r.dateString === dateStr));
         setDB('registrations', registrations);
         renderAttendees(classId, dateStr);
         renderCalendar();
    };

    const addNewStudent = (e) => {
        e.preventDefault();
        const name = document.getElementById('new-student-name').value;
        const email = document.getElementById('new-student-email').value;
        const phone = document.getElementById('new-student-phone').value;

        if (students.some(s => s.email.toLowerCase() === email.toLowerCase())) {
            alert('Ya existe un alumno con este email.');
            return;
        }

        const newId = students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1;
        students.push({ id: newId, name, email, phone });
        setDB('students', students);
        
        closeNewStudentModal();
        renderStudents();
    };

    const removeStudent = (studentId) => {
        students = students.filter(s => s.id !== studentId);
        registrations = registrations.filter(r => r.studentId !== studentId);
        setDB('students', students);
        setDB('registrations', registrations);
        renderStudents();
        if (currentView === 'horario') renderCalendar();
    };
    
    const openNewStudentModal = () => {
        newStudentForm.reset();
        newStudentModal.classList.remove('hidden');
        newStudentModal.classList.add('flex');
    };

    const closeNewStudentModal = () => {
        newStudentModal.classList.add('hidden');
        newStudentModal.classList.remove('flex');
    };

    // --- EVENT LISTENERS ---
    document.getElementById('nav-horario').addEventListener('click', () => switchView('horario'));
    document.getElementById('nav-alumnos').addEventListener('click', () => switchView('alumnos'));

    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekOffset--;
        renderCalendar();
    });
    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekOffset++;
        renderCalendar();
    });

    document.getElementById('close-class-modal').addEventListener('click', closeClassModal);
    document.getElementById('close-class-modal-btn').addEventListener('click', closeClassModal);
    document.getElementById('add-student-to-class-btn').addEventListener('click', addStudentToClass);

    document.getElementById('open-new-student-modal').addEventListener('click', openNewStudentModal);
    document.getElementById('close-new-student-modal').addEventListener('click', closeNewStudentModal);
    document.getElementById('cancel-new-student').addEventListener('click', closeNewStudentModal);
    newStudentForm.addEventListener('submit', addNewStudent);
    
    document.getElementById('student-search-input').addEventListener('input', (e) => {
        renderStudents(e.target.value);
    });
    
    // --- INICIALIZACIÓN ---
    initializeDB();
    switchView('horario');
});
