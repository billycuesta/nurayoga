// models/Student.js

class Student {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.fechaAlta = data.fechaAlta ? new Date(data.fechaAlta) : new Date();
        this.fechaBaja = data.fechaBaja ? new Date(data.fechaBaja) : null;
        // Objeto para guardar pagos: {"YYYY-MM": "ISO_DATE_STRING" | null}
        this.payments = data.payments || {};
    }

    /**
     * Devuelve la fecha de pago para un mes específico.
     * @param {string} yearMonth - El mes en formato "YYYY-MM".
     * @returns {string|null} - La fecha en formato ISO si está pagado, o null si no.
     */
    getPaymentDateForMonth(yearMonth) {
        return this.payments[yearMonth] || null;
    }

    /**
     * Cambia el estado de pago para un mes específico y guarda el alumno.
     * Si no está pagado, guarda la fecha actual. Si ya está pagado, lo resetea a null.
     * @param {string} yearMonth - El mes en formato "YYYY-MM".
     */
    async togglePaymentForMonth(yearMonth) {
        const paymentDate = this.getPaymentDateForMonth(yearMonth);

        if (paymentDate) {
            // Si ya hay una fecha, significa que está pagado. Lo reseteamos.
            this.payments[yearMonth] = null;
        } else {
            // Si no está pagado, guardamos la fecha y hora actual en formato ISO.
            this.payments[yearMonth] = new Date().toISOString();
        }
        
        await this.save(); // Guarda el alumno con el nuevo estado de pago.
    }

    validate() {
        const errors = [];
        if (!this.name || this.name.trim().length === 0) {
            errors.push('El nombre es obligatorio');
        }
        if (this.name.length > 100) {
            errors.push('El nombre no puede tener más de 100 caracteres');
        }
        if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            errors.push('El formato del email no es válido');
        }
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

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
            return scheduleTemplate.find(t => t.id === inscription.templateId);
        }).filter(Boolean);

        const oneOffClassesData = inscriptions.oneOff.map(inscription => {
            return oneOffClasses.find(c => c.id === inscription.oneOffClassId);
        }).filter(Boolean);

        return {
            recurring: recurringClasses,
            oneOff: oneOffClassesData,
            total: recurringClasses.length + oneOffClassesData.length
        };
    }

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

    toDBFormat() {
        const data = {
            name: this.name.trim(),
            email: this.email.trim(),
            phone: this.phone.trim(),
            fechaAlta: this.fechaAlta.toISOString(),
            fechaBaja: this.fechaBaja ? this.fechaBaja.toISOString() : null,
            payments: this.payments
        };
        if (this.id) {
            data.id = this.id;
        }
        return data;
    }

    static async findById(id) {
        const students = await window.db.getAllStudents();
        const studentData = students.find(s => s.id === id);
        return studentData ? new Student(studentData) : null;
    }

    static async findAll() {
        const studentsData = await window.db.getAllStudents();
        return studentsData.map(data => new Student(data));
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