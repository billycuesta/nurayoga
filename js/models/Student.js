// models/Student.js
class Student {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.fechaAlta = data.fechaAlta ? new Date(data.fechaAlta) : new Date();
        this.fechaBaja = data.fechaBaja ? new Date(data.fechaBaja) : null;
    }

    // Validaciones
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('El nombre es obligatorio');
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
        // Acepta formatos: +34 xxx xxx xxx, 6xx xxx xxx, 9xx xxx xxx
        const phoneRegex = /^(\+34\s?)?[6-9]\d{8}$/;
        const cleanPhone = phone.replace(/\s/g, '');
        return phoneRegex.test(cleanPhone);
    }

    // Preparar datos para guardar en DB
    toDBFormat() {
        this.updatedAt = new Date().toISOString();
        const data = {
            name: this.name.trim(),
            email: this.email.trim(),
            phone: this.phone.trim(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
        
        if (this.id) {
            data.id = this.id;
        }
        
        return data;
    }

    // Métodos de consulta que usan la base de datos
    async getInscriptions() {
        if (!this.id) return { oneOff: [], recurring: [] };
        return await window.db.getStudentInscriptions(this.id);
    }

    async getActiveClasses() {
        const inscriptions = await this.getInscriptions();
        const [scheduleTemplate, oneOffClasses] = await Promise.all([
            window.db.getAllScheduleTemplates(),
            window.db.getAllOneOffClasses()
        ]);

        const recurringClasses = inscriptions.recurring.map(inscription => {
            const template = scheduleTemplate.find(t => t.id === inscription.templateId);
            return template ? { ...template, type: 'recurring', inscriptionId: inscription.id } : null;
        }).filter(Boolean);

        const oneOffClassesData = inscriptions.oneOff.map(inscription => {
            const oneOffClass = oneOffClasses.find(c => c.id === inscription.oneOffClassId);
            return oneOffClass ? { ...oneOffClass, type: 'one-off', inscriptionId: inscription.id } : null;
        }).filter(Boolean);

        return {
            recurring: recurringClasses,
            oneOff: oneOffClassesData,
            total: recurringClasses.length + oneOffClassesData.length
        };
    }

    // Métodos de acción
    async save() {
        const validation = this.validate();
        if (!validation.isValid) {
            throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
        }

        const data = this.toDBFormat();
        
        if (this.id) {
            await window.db.updateStudent(data);
        } else {
            const newId = await window.db.addStudent(data);
            this.id = newId;
        }
        
        return this;
    }

    async delete() {
        if (!this.id) {
            throw new Error('No se puede eliminar un estudiante sin ID');
        }
        
        await window.db.deleteStudent(this.id);
        return true;
    }

    // Métodos estáticos para crear/buscar estudiantes
    static async findById(id) {
        const students = await window.db.getAllStudents();
        const studentData = students.find(s => s.id === id);
        return studentData ? new Student(studentData) : null;
    }

    static async findAll() {
        const studentsData = await window.db.getAllStudents();
        return studentsData.map(data => new Student(data));
    }

    static async search(query) {
        const students = await Student.findAll();
        const lowerQuery = query.toLowerCase();
        
        return students.filter(student => 
            student.name.toLowerCase().includes(lowerQuery) ||
            student.email.toLowerCase().includes(lowerQuery)
        );
    }

    static async create(data) {
        const student = new Student(data);
        return await student.save();
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

    hasEmail() {
        return this.email && this.email.trim().length > 0;
    }

    hasPhone() {
        return this.phone && this.phone.trim().length > 0;
    }

    // Método para obtener estadísticas del estudiante
    async getStats() {
        const classes = await this.getActiveClasses();
        const inscriptions = await this.getInscriptions();
        
        return {
            totalClasses: classes.total,
            recurringClasses: classes.recurring.length,
            oneOffClasses: classes.oneOff.length,
            totalInscriptions: inscriptions.oneOff.length + inscriptions.recurring.length,
            hasContactInfo: this.hasEmail() || this.hasPhone()
        };
    }

    // Serializar para JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
        toDBFormat() {
        const data = {
            name: this.name.trim(),
            email: this.email.trim(),
            phone: this.phone.trim(),
            fechaAlta: this.fechaAlta.toISOString(),
            fechaBaja: this.fechaBaja ? this.fechaBaja.toISOString() : null
        };
        
        if (this.id) {
            data.id = this.id;
        }
        
        return data;
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Student = Student;
}

// Para Node.js si algún día lo necesitas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Student;
}