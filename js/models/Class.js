// models/Class.js
class Class {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.teacher = data.teacher || '';
        this.capacity = data.capacity || 10;
        this.time = data.time || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        
        // Campos específicos según el tipo
        this.type = data.type || null; // 'recurring' o 'one-off'
        this.day = data.day || null; // Para clases recurrentes (1-7, lunes-domingo)
        this.date = data.date || null; // Para clases puntuales (YYYY-MM-DD)
    }

    // Validaciones comunes
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('El nombre de la clase es obligatorio');
        }
        
        if (this.name.length > 100) {
            errors.push('El nombre no puede tener más de 100 caracteres');
        }
        
        if (!this.teacher || this.teacher.trim().length === 0) {
            errors.push('El profesor es obligatorio');
        }
        
        if (!this.time || !this.isValidTime(this.time)) {
            errors.push('La hora debe tener formato HH:MM válido');
        }
        
        if (!this.capacity || this.capacity < 1 || this.capacity > 50) {
            errors.push('La capacidad debe estar entre 1 y 50 personas');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    isValidTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }
    
    isValidDate(date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;
        
        const parsedDate = new Date(date);
        return parsedDate instanceof Date && !isNaN(parsedDate);
    }

    // Preparar datos para DB
    toDBFormat() {
        this.updatedAt = new Date().toISOString();
        const data = {
            name: this.name.trim(),
            teacher: this.teacher.trim(),
            capacity: parseInt(this.capacity),
            time: this.time,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        
        if (this.id) {
            data.id = this.id;
        }
        
        return data;
    }

    // Métodos para obtener inscripciones
    async getInscriptions() {
        if (!this.id) return [];
        
        if (this.type === 'recurring') {
            return await window.db.getClassAttendees(this.id, true);
        } else {
            return await window.db.getClassAttendees(this.id, false);
        }
    }

    async getStudents() {
        const inscriptions = await this.getInscriptions();
        const allStudents = await window.db.getAllStudents();
        
        return inscriptions.map(inscription => {
            const student = allStudents.find(s => s.id === inscription.studentId);
            return student ? { ...student, inscriptionId: inscription.id } : null;
        }).filter(Boolean);
    }

    async getCurrentOccupancy() {
        const inscriptions = await this.getInscriptions();
        return inscriptions.length;
    }

    async isFull() {
        const currentOccupancy = await this.getCurrentOccupancy();
        return currentOccupancy >= this.capacity;
    }

    async getAvailableSpots() {
        const currentOccupancy = await this.getCurrentOccupancy();
        return Math.max(0, this.capacity - currentOccupancy);
    }

    // Métodos para gestionar inscripciones
    async addStudent(studentId) {
        if (await this.isFull()) {
            throw new Error('La clase está completa');
        }
        
        // Verificar que el estudiante no esté ya inscrito
        const inscriptions = await this.getInscriptions();
        const isAlreadyEnrolled = inscriptions.some(i => i.studentId === studentId);
        
        if (isAlreadyEnrolled) {
            throw new Error('El estudiante ya está inscrito en esta clase');
        }
        
        const inscriptionData = { studentId: studentId };
        
        if (this.type === 'recurring') {
            inscriptionData.templateId = this.id;
            return await window.db.addRecurringInscription(inscriptionData);
        } else {
            inscriptionData.oneOffClassId = this.id;
            inscriptionData.date = this.date;
            return await window.db.addInscription(inscriptionData);
        }
    }

    async removeStudent(studentId) {
        const inscriptions = await this.getInscriptions();
        const inscription = inscriptions.find(i => i.studentId === studentId);
        
        if (!inscription) {
            throw new Error('El estudiante no está inscrito en esta clase');
        }
        
        if (this.type === 'recurring') {
            return await window.db.deleteRecurringInscription(inscription.id);
        } else {
            return await window.db.deleteInscription(inscription.id);
        }
    }

    // Métodos de información
    getDisplayTime() {
        return this.time;
    }

    getDisplayDay() {
        if (this.type !== 'recurring' || !this.day) return '';
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[this.day] || '';
    }

    getDisplayDate() {
        if (this.type !== 'one-off' || !this.date) return '';
        return new Date(this.date + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }

    getColorForTeacher() {
        if (!this.teacher) return '#C0A164'; 
        let hash = 0;
        for (let i = 0; i < this.teacher.length; i++) {
            hash = this.teacher.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 60%, 75%)`;
    }

    async getStats() {
        const [currentOccupancy, students] = await Promise.all([
            this.getCurrentOccupancy(),
            this.getStudents()
        ]);
        
        return {
            currentOccupancy: currentOccupancy,
            capacity: this.capacity,
            availableSpots: this.capacity - currentOccupancy,
            occupancyPercentage: Math.round((currentOccupancy / this.capacity) * 100),
            isFull: currentOccupancy >= this.capacity,
            students: students,
            studentsWithEmail: students.filter(s => s.email && s.email.length > 0).length,
            studentsWithPhone: students.filter(s => s.phone && s.phone.length > 0).length
        };
    }

    toJSON() {
        const base = {
            id: this.id,
            name: this.name,
            teacher: this.teacher,
            capacity: this.capacity,
            time: this.time,
            type: this.type,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        
        if (this.type === 'recurring') {
            base.day = this.day;
        } else if (this.type === 'one-off') {
            base.date = this.date;
        }
        
        return base;
    }
}

// Clase específica para clases recurrentes
class RecurringClass extends Class {
    constructor(data = {}) {
        super({ ...data, type: 'recurring' });
        this.day = data.day || 1; // 1 = Lunes, 2 = Martes, etc.
    }

    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        
        if (!this.day || this.day < 1 || this.day > 7) {
            errors.push('El día debe estar entre 1 (Lunes) y 7 (Domingo)');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    toDBFormat() {
        const data = super.toDBFormat();
        data.day = parseInt(this.day);
        return data;
    }

    async save() {
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
        }

        const data = this.toDBFormat();
        
        if (this.id) {
            await window.db.updateScheduleTemplate(data);
        } else {
            const newId = await window.db.addScheduleTemplate(data);
            this.id = newId;
        }
        
        return this;
    }

    async delete() {
        if (!this.id) {
            throw new Error('No se puede eliminar una clase sin ID');
        }
        
        await window.db.deleteScheduleTemplate(this.id);
        return true;
    }

    static async findAll() {
        const classesData = await window.db.getAllScheduleTemplates();
        return classesData.map(data => new RecurringClass(data));
    }

    static async findById(id) {
        const classes = await RecurringClass.findAll();
        return classes.find(c => c.id === id) || null;
    }
}

// Clase específica para clases puntuales
class OneOffClass extends Class {
    constructor(data = {}) {
        super({ ...data, type: 'one-off' });
        this.date = data.date || '';
    }

    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        
        if (!this.date || !this.isValidDate(this.date)) {
            errors.push('La fecha debe tener formato YYYY-MM-DD válido');
        }
        
        // Verificar que la fecha no sea pasada
        const today = new Date();
        const classDate = new Date(this.date);
        if (classDate < today.setHours(0, 0, 0, 0)) {
            errors.push('La fecha no puede ser anterior a hoy');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    toDBFormat() {
        const data = super.toDBFormat();
        data.date = this.date;
        return data;
    }

    async save() {
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
        }

        const data = this.toDBFormat();
        
        if (this.id) {
            await window.db.updateOneOffClass(data);
        } else {
            const newId = await window.db.addOneOffClass(data);
            this.id = newId;
        }
        
        return this;
    }

    async delete() {
        if (!this.id) {
            throw new Error('No se puede eliminar una clase sin ID');
        }
        
        await window.db.deleteOneOffClass(this.id);
        return true;
    }

    static async findAll() {
        const classesData = await window.db.getAllOneOffClasses();
        return classesData.map(data => new OneOffClass(data));
    }

    static async findById(id) {
        const classes = await OneOffClass.findAll();
        return classes.find(c => c.id === id) || null;
    }

    static async findByDate(date) {
        const classes = await OneOffClass.findAll();
        return classes.filter(c => c.date === date);
    }
}

// Factory para crear clases según el tipo
class ClassFactory {
    static create(type, data = {}) {
        switch (type) {
            case 'recurring':
                return new RecurringClass(data);
            case 'one-off':
                return new OneOffClass(data);
            default:
                throw new Error(`Tipo de clase desconocido: ${type}`);
        }
    }

    static async findById(id, type) {
        if (type === 'recurring') {
            return await RecurringClass.findById(id);
        } else if (type === 'one-off') {
            return await OneOffClass.findById(id);
        }
        throw new Error(`Tipo de clase desconocido: ${type}`);
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Class = Class;
    window.RecurringClass = RecurringClass;
    window.OneOffClass = OneOffClass;
    window.ClassFactory = ClassFactory;
}

// Para Node.js si algún día lo necesitas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Class, RecurringClass, OneOffClass, ClassFactory };
}