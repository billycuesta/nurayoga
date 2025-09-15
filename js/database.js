// database.js - Gestión completa de IndexedDB
class Database {
    constructor() {
        this.db = null;
        this.DB_NAME = 'NuraYogaDB';
        this.DB_VERSION = 4;
        this.STORES = {
            students: 'students',
            teachers: 'teachers',
            scheduleTemplate: 'scheduleTemplate',
            oneOffClasses: 'oneOffClasses',
            inscriptions: 'inscriptions',
            recurringInscriptions: 'recurringInscriptions'
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = event => {
                console.error("Database error:", event.target.error);
                reject("Database error");
            };
            
            request.onupgradeneeded = event => {
                const db = event.target.result;
                Object.values(this.STORES).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                    }
                });
            };
            
            request.onsuccess = event => {
                this.db = event.target.result;
                console.log("Database opened successfully");
                resolve(this.db);
            };
        });
    }

    // Operaciones CRUD genéricas
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async add(storeName, item) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async update(storeName, item) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject("DB not initialized");
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    // Métodos específicos del dominio - más legibles en el código principal
    
    // Students
    async getAllStudents() {
        return this.getAll(this.STORES.students);
    }

    async addStudent(student) {
        return this.add(this.STORES.students, student);
    }

    async updateStudent(student) {
        return this.update(this.STORES.students, student);
    }

    async deleteStudent(studentId) {
        // Eliminar también sus inscripciones
        const [inscriptions, recurringInscriptions] = await Promise.all([
            this.getAll(this.STORES.inscriptions),
            this.getAll(this.STORES.recurringInscriptions)
        ]);

        const deletePromises = [
            ...inscriptions.filter(i => i.studentId === studentId).map(i => this.delete(this.STORES.inscriptions, i.id)),
            ...recurringInscriptions.filter(i => i.studentId === studentId).map(i => this.delete(this.STORES.recurringInscriptions, i.id)),
            this.delete(this.STORES.students, studentId)
        ];

        return Promise.all(deletePromises);
    }

    // Teachers
    async getAllTeachers() {
        return this.getAll(this.STORES.teachers);
    }

    async addTeacher(teacher) {
        return this.add(this.STORES.teachers, teacher);
    }

    // Schedule Template (Clases Fijas)
    async getAllScheduleTemplates() {
        return this.getAll(this.STORES.scheduleTemplate);
    }

    async addScheduleTemplate(template) {
        return this.add(this.STORES.scheduleTemplate, template);
    }

    async updateScheduleTemplate(template) {
        return this.update(this.STORES.scheduleTemplate, template);
    }

    async deleteScheduleTemplate(templateId) {
        // Eliminar también las inscripciones recurrentes
        const recurringInscriptions = await this.getAll(this.STORES.recurringInscriptions);
        const deletePromises = [
            ...recurringInscriptions.filter(i => i.templateId === templateId).map(i => this.delete(this.STORES.recurringInscriptions, i.id)),
            this.delete(this.STORES.scheduleTemplate, templateId)
        ];
        return Promise.all(deletePromises);
    }

    // One-off Classes (Clases Puntuales)
    async getAllOneOffClasses() {
        return this.getAll(this.STORES.oneOffClasses);
    }

    async addOneOffClass(oneOffClass) {
        return this.add(this.STORES.oneOffClasses, oneOffClass);
    }

    async updateOneOffClass(oneOffClass) {
        return this.update(this.STORES.oneOffClasses, oneOffClass);
    }

    async deleteOneOffClass(classId) {
        // Eliminar también las inscripciones
        const inscriptions = await this.getAll(this.STORES.inscriptions);
        const deletePromises = [
            ...inscriptions.filter(i => i.oneOffClassId === classId).map(i => this.delete(this.STORES.inscriptions, i.id)),
            this.delete(this.STORES.oneOffClasses, classId)
        ];
        return Promise.all(deletePromises);
    }

    // Inscriptions
    async getAllInscriptions() {
        return this.getAll(this.STORES.inscriptions);
    }

    async addInscription(inscription) {
        return this.add(this.STORES.inscriptions, inscription);
    }

    async deleteInscription(inscriptionId) {
        return this.delete(this.STORES.inscriptions, inscriptionId);
    }

    async getAllRecurringInscriptions() {
        return this.getAll(this.STORES.recurringInscriptions);
    }

    async addRecurringInscription(inscription) {
        return this.add(this.STORES.recurringInscriptions, inscription);
    }

    async deleteRecurringInscription(inscriptionId) {
        return this.delete(this.STORES.recurringInscriptions, inscriptionId);
    }

    // Operaciones de mantenimiento
    async clearAllInscriptions() {
        return Promise.all([
            this.clear(this.STORES.inscriptions),
            this.clear(this.STORES.recurringInscriptions)
        ]);
    }

    // Método para cargar todos los datos de una vez
    async loadAllData() {
        return Promise.all([
            this.getAllStudents(),
            this.getAllTeachers(),
            this.getAllScheduleTemplates(),
            this.getAllOneOffClasses(),
            this.getAllInscriptions(),
            this.getAllRecurringInscriptions()
        ]);
    }

    // Métodos de consulta útiles
    async getStudentInscriptions(studentId) {
        const [inscriptions, recurringInscriptions] = await Promise.all([
            this.getAllInscriptions(),
            this.getAllRecurringInscriptions()
        ]);

        return {
            oneOff: inscriptions.filter(i => i.studentId === studentId),
            recurring: recurringInscriptions.filter(i => i.studentId === studentId)
        };
    }

    async getClassAttendees(classId, isRecurring = false) {
        const storeName = isRecurring ? this.STORES.recurringInscriptions : this.STORES.inscriptions;
        const inscriptions = await this.getAll(storeName);
        const filterKey = isRecurring ? 'templateId' : 'oneOffClassId';
        
        return inscriptions.filter(i => i[filterKey] === classId);
    }

    async clearAllStudentsAndRelatedData() {
        console.log("Borrando todos los alumnos y sus datos relacionados...");
        // Borra los datos de las tres tablas relacionadas
        return Promise.all([
            this.clear(this.STORES.students),
            this.clear(this.STORES.inscriptions),
            this.clear(this.STORES.recurringInscriptions)
        ]);
    }
}

// Crear instancia global
window.db = new Database();