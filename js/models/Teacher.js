// models/Teacher.js
class Teacher {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.specialties = data.specialties || []; // ej: ['Hatha', 'Vinyasa', 'Yin']
        this.bio = data.bio || '';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.hourlyRate = data.hourlyRate || 0;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    // Validaciones
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('El nombre del profesor es obligatorio');
        }
        
        if (this.name.length > 100) {
            errors.push('El nombre no puede tener más de 100 caracteres');
        }
        
        if (this.email && !this.isValidEmail(this.email)) {
            errors.push('El formato del email no es válido');
        }
        
        if (this.phone && !this.isValidPhone(this.phone)) {
            errors.push('El formato del teléfono no es válido');
        }
        
        if (this.bio && this.bio.length > 500) {
            errors.push('La biografía no puede tener más de 500 caracteres');
        }
        
        if (this.hourlyRate && (this.hourlyRate < 0 || this.hourlyRate > 1000)) {
            errors.push('La tarifa por hora debe estar entre 0 y 1000 euros');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    isValidPhone(phone) {
        const phoneRegex = /^(\+34\s?)?[6-9]\d{8}$/;
        const cleanPhone = phone.replace(/\s/g, '');
        return phoneRegex.test(cleanPhone);
    }

    // Preparar datos para DB
    toDBFormat() {
        this.updatedAt = new Date().toISOString();
        const data = {
            name: this.name.trim(),
            email: this.email.trim(),
            phone: this.phone.trim(),
            specialties: Array.isArray(this.specialties) ? this.specialties : [],
            bio: this.bio.trim(),
            isActive: Boolean(this.isActive),
            hourlyRate: parseFloat(this.hourlyRate) || 0,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        
        if (this.id) {
            data.id = this.id;
        }
        
        return data;
    }

    // Métodos para obtener clases del profesor
    async getClasses() {
        const [scheduleTemplates, oneOffClasses] = await Promise.all([
            window.db.getAllScheduleTemplates(),
            window.db.getAllOneOffClasses()
        ]);
        
        const recurringClasses = scheduleTemplates
            .filter(template => template.teacher === this.name)
            .map(template => ({ ...template, type: 'recurring' }));
            
        const oneOffClassesFiltered = oneOffClasses
            .filter(oneOff => oneOff.teacher === this.name)
            .map(oneOff => ({ ...oneOff, type: 'one-off' }));
        
        return {
            recurring: recurringClasses,
            oneOff: oneOffClassesFiltered,
            total: recurringClasses.length + oneOffClassesFiltered.length
        };
    }

    async getActiveClasses() {
        const classes = await this.getClasses();
        
        // Filtrar clases puntuales futuras
        const today = new Date().toISOString().split('T')[0];
        const futureOneOffClasses = classes.oneOff.filter(c => c.date >= today);
        
        return {
            recurring: classes.recurring,
            oneOff: futureOneOffClasses,
            total: classes.recurring.length + futureOneOffClasses.length
        };
    }

    async getStudents() {
        const classes = await this.getActiveClasses();
        const [inscriptions, recurringInscriptions, allStudents] = await Promise.all([
            window.db.getAllInscriptions(),
            window.db.getAllRecurringInscriptions(),
            window.db.getAllStudents()
        ]);

        // IDs de estudiantes únicos
        const studentIds = new Set();
        
        // Estudiantes de clases recurrentes
        classes.recurring.forEach(recurringClass => {
            const classInscriptions = recurringInscriptions.filter(i => i.templateId === recurringClass.id);
            classInscriptions.forEach(i => studentIds.add(i.studentId));
        });
        
        // Estudiantes de clases puntuales
        classes.oneOff.forEach(oneOffClass => {
            const classInscriptions = inscriptions.filter(i => i.oneOffClassId === oneOffClass.id);
            classInscriptions.forEach(i => studentIds.add(i.studentId));
        });
        
        // Convertir a objetos estudiante
        const students = Array.from(studentIds)
            .map(id => allStudents.find(s => s.id === id))
            .filter(Boolean);
            
        return students;
    }

    async getWeeklySchedule() {
        const classes = await this.getActiveClasses();
        const schedule = {};
        
        // Inicializar días de la semana
        ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach((day, index) => {
            schedule[day] = [];
        });
        
        // Añadir clases recurrentes
        classes.recurring.forEach(recurringClass => {
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dayName = dayNames[recurringClass.day];
            if (schedule[dayName]) {
                schedule[dayName].push({
                    ...recurringClass,
                    time: recurringClass.time,
                    name: recurringClass.name
                });
            }
        });
        
        // Ordenar por hora en cada día
        Object.keys(schedule).forEach(day => {
            schedule[day].sort((a, b) => a.time.localeCompare(b.time));
        });
        
        return schedule;
    }

    // Métodos de utilidad
    getDisplayName() {
        return this.name;
    }

    getInitials() {
        return this.name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    getColorHash() {
        if (!this.name) return '#C0A164';
        let hash = 0;
        for (let i = 0; i < this.name.length; i++) {
            hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 60%, 75%)`;
    }

    hasContactInfo() {
        return (this.email && this.email.trim().length > 0) || 
               (this.phone && this.phone.trim().length > 0);
    }

    addSpecialty(specialty) {
        const trimmedSpecialty = specialty.trim();
        if (trimmedSpecialty && !this.specialties.includes(trimmedSpecialty)) {
            this.specialties.push(trimmedSpecialty);
        }
        return this;
    }

    removeSpecialty(specialty) {
        this.specialties = this.specialties.filter(s => s !== specialty);
        return this;
    }

    hasSpecialty(specialty) {
        return this.specialties.includes(specialty);
    }

    // Estadísticas del profesor
    async getStats() {
        const [classes, students] = await Promise.all([
            this.getActiveClasses(),
            this.getStudents()
        ]);
        
        const [inscriptions, recurringInscriptions] = await Promise.all([
            window.db.getAllInscriptions(),
            window.db.getAllRecurringInscriptions()
        ]);
        
        // Calcular ocupación total
        let totalCapacity = 0;
        let totalOccupancy = 0;
        
        classes.recurring.forEach(recurringClass => {
            const classInscriptions = recurringInscriptions.filter(i => i.templateId === recurringClass.id);
            totalCapacity += recurringClass.capacity;
            totalOccupancy += classInscriptions.length;
        });
        
        classes.oneOff.forEach(oneOffClass => {
            const classInscriptions = inscriptions.filter(i => i.oneOffClassId === oneOffClass.id);
            totalCapacity += oneOffClass.capacity;
            totalOccupancy += classInscriptions.length;
        });
        
        return {
            totalClasses: classes.total,
            recurringClasses: classes.recurring.length,
            oneOffClasses: classes.oneOff.length,
            totalStudents: students.length,
            totalCapacity: totalCapacity,
            totalOccupancy: totalOccupancy,
            occupancyRate: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
            studentsWithEmail: students.filter(s => s.email && s.email.length > 0).length,
            studentsWithPhone: students.filter(s => s.phone && s.phone.length > 0).length,
            specialties: this.specialties.length,
            hasContactInfo: this.hasContactInfo(),
            isActive: this.isActive
        };
    }

    // Métodos CRUD
    async save() {
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
        }

        const data = this.toDBFormat();
        
        if (this.id) {
            await window.db.updateTeacher(data);
        } else {
            const newId = await window.db.addTeacher(data);
            this.id = newId;
        }
        
        return this;
    }

    async delete() {
        if (!this.id) {
            throw new Error('No se puede eliminar un profesor sin ID');
        }
        
        // Verificar si tiene clases asignadas
        const classes = await this.getActiveClasses();
        if (classes.total > 0) {
            throw new Error(`No se puede eliminar el profesor porque tiene ${classes.total} clase(s) asignada(s)`);
        }
        
        await window.db.deleteTeacher(this.id);
        return true;
    }

    async deactivate() {
        this.isActive = false;
        return await this.save();
    }

    async activate() {
        this.isActive = true;
        return await this.save();
    }

    // Métodos estáticos
    static async findById(id) {
        const teachers = await window.db.getAllTeachers();
        const teacherData = teachers.find(t => t.id === id);
        return teacherData ? new Teacher(teacherData) : null;
    }

    static async findByName(name) {
        const teachers = await window.db.getAllTeachers();
        const teacherData = teachers.find(t => t.name === name);
        return teacherData ? new Teacher(teacherData) : null;
    }

    static async findAll() {
        const teachersData = await window.db.getAllTeachers();
        return teachersData.map(data => new Teacher(data));
    }

    static async findActive() {
        const teachers = await Teacher.findAll();
        return teachers.filter(teacher => teacher.isActive);
    }

    static async search(query) {
        const teachers = await Teacher.findAll();
        const lowerQuery = query.toLowerCase();
        
        return teachers.filter(teacher => 
            teacher.name.toLowerCase().includes(lowerQuery) ||
            teacher.email.toLowerCase().includes(lowerQuery) ||
            teacher.specialties.some(specialty => 
                specialty.toLowerCase().includes(lowerQuery)
            )
        );
    }

    static async create(data) {
        const teacher = new Teacher(data);
        return await teacher.save();
    }

    static async getAllSpecialties() {
        const teachers = await Teacher.findAll();
        const allSpecialties = new Set();
        
        teachers.forEach(teacher => {
            teacher.specialties.forEach(specialty => {
                allSpecialties.add(specialty);
            });
        });
        
        return Array.from(allSpecialties).sort();
    }

    // Reportes y análisis
    static async getTeachingStats() {
        const teachers = await Teacher.findAll();
        const stats = await Promise.all(teachers.map(teacher => teacher.getStats()));
        
        return {
            totalTeachers: teachers.length,
            activeTeachers: teachers.filter(t => t.isActive).length,
            totalClasses: stats.reduce((sum, stat) => sum + stat.totalClasses, 0),
            totalStudents: new Set(
                await Promise.all(teachers.map(t => t.getStudents().then(students => students.map(s => s.id))))
            ).size,
            averageOccupancy: Math.round(
                stats.reduce((sum, stat) => sum + stat.occupancyRate, 0) / stats.length
            ),
            teachersWithContactInfo: teachers.filter(t => t.hasContactInfo()).length,
            allSpecialties: await Teacher.getAllSpecialties()
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            specialties: this.specialties,
            bio: this.bio,
            isActive: this.isActive,
            hourlyRate: this.hourlyRate,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Teacher = Teacher;
}

// Para Node.js si algún día lo necesitas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Teacher;
}