// ui.js - Componentes de interfaz reutilizables

// === COMPONENTE MODAL GENÉRICO ===
class Modal {
    constructor(modalId, options = {}) {
        this.modal = document.getElementById(modalId);
        this.options = {
            closeOnBackdrop: true,
            closeOnEscape: true,
            ...options
        };
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Cerrar con backdrop
        if (this.options.closeOnBackdrop) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            });
        }

        // Cerrar con Escape
        if (this.options.closeOnEscape) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                    this.hide();
                }
            });
        }

        // Botones de cerrar
        const closeButtons = this.modal.querySelectorAll('[id^="close-"], [id^="cancel-"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.hide());
        });
    }

    show() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevenir scroll
            this.modal.querySelector('input, select, textarea')?.focus(); // Focus automático
        }
    }

    hide() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restaurar scroll
        }
    }

    toggle() {
        if (this.modal.classList.contains('hidden')) {
            this.show();
        } else {
            this.hide();
        }
    }
}

// === COMPONENTE FORMULARIO ===
class FormHandler {
    constructor(formId, options = {}) {
        this.form = document.getElementById(formId);
        this.options = {
            showErrors: true,
            clearOnSubmit: true,
            autoValidate: true,
            ...options
        };
        this.validators = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.form) return;

        // Validación en tiempo real
        if (this.options.autoValidate) {
            this.form.addEventListener('input', (e) => {
                this.validateField(e.target);
            });
        }

        // Prevenir submit por defecto
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    addValidator(fieldName, validatorFn) {
        this.validators[fieldName] = validatorFn;
    }

    validateField(field) {
        const validator = this.validators[field.name || field.id];
        if (validator) {
            const result = validator(field.value);
            this.showFieldError(field, result);
            return result.isValid;
        }
        return true;
    }

    validateAll() {
        let isValid = true;
        const formData = this.getData();
        
        Object.keys(this.validators).forEach(fieldName => {
            const field = this.form.querySelector(`[name="${fieldName}"], #${fieldName}`);
            if (field) {
                const fieldValid = this.validateField(field);
                if (!fieldValid) isValid = false;
            }
        });

        return isValid;
    }

    showFieldError(field, validation) {
        if (!this.options.showErrors) return;

        // Remover error anterior
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // Cambiar estilo del campo
        if (validation.isValid) {
            field.classList.remove('border-red-500');
            field.classList.add('border-green-500');
        } else {
            field.classList.add('border-red-500');
            field.classList.remove('border-green-500');
            
            // Mostrar mensaje de error
            const errorDiv = DOMUtils.createElement('div', 'field-error text-red-500 text-sm mt-1', validation.error);
            field.parentNode.appendChild(errorDiv);
        }
    }

    getData() {
        return DOMUtils.getFormData(this.form);
    }

    setData(data) {
        DOMUtils.populateForm(this.form, data);
    }

    clear() {
        DOMUtils.clearForm(this.form);
        // Limpiar errores
        this.form.querySelectorAll('.field-error').forEach(error => error.remove());
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.classList.remove('border-red-500', 'border-green-500');
        });
    }

    onSubmit(callback) {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateAll()) {
                const data = this.getData();
                callback(data, e);
                if (this.options.clearOnSubmit) {
                    this.clear();
                }
            }
        });
    }
}

// === COMPONENTE TABLA ===
class Table {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            searchable: true,
            sortable: true,
            paginate: false,
            pageSize: 10,
            emptyMessage: 'No hay datos para mostrar',
            ...options
        };
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchQuery = '';
    }

    setColumns(columns) {
        this.columns = columns;
        return this;
    }

    setData(data) {
        this.data = data;
        this.filteredData = [...data];
        this.render();
        return this;
    }

    search(query) {
        this.searchQuery = query.toLowerCase();
        this.filteredData = this.data.filter(item => 
            this.columns.some(col => {
                const value = this.getCellValue(item, col.key);
                return value && value.toString().toLowerCase().includes(this.searchQuery);
            })
        );
        this.currentPage = 1;
        this.render();
        return this;
    }

    sort(columnKey, direction = null) {
        this.sortColumn = columnKey;
        this.sortDirection = direction || (this.sortDirection === 'asc' ? 'desc' : 'asc');
        
        this.filteredData.sort((a, b) => {
            const aVal = this.getCellValue(a, columnKey);
            const bVal = this.getCellValue(b, columnKey);
            
            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        this.render();
        return this;
    }

    getCellValue(item, key) {
        return key.split('.').reduce((obj, prop) => obj && obj[prop], item);
    }

    render() {
        if (!this.container || !this.columns) return;

        // Calcular datos de la página actual
        const startIndex = (this.currentPage - 1) * this.options.pageSize;
        const endIndex = startIndex + this.options.pageSize;
        const pageData = this.options.paginate ? 
            this.filteredData.slice(startIndex, endIndex) : 
            this.filteredData;

        // Crear tabla
        const table = DOMUtils.createElement('table', 'w-full text-left');
        
        // Header
        const thead = DOMUtils.createElement('thead', 'sticky top-0 bg-gray-50');
        const headerRow = DOMUtils.createElement('tr');
        
        this.columns.forEach(col => {
            const th = DOMUtils.createElement('th', 'p-4 font-semibold', col.title);
            
            if (this.options.sortable && col.sortable !== false) {
                th.classList.add('cursor-pointer', 'hover:bg-gray-100');
                th.addEventListener('click', () => this.sort(col.key));
                
                if (this.sortColumn === col.key) {
                    const arrow = this.sortDirection === 'asc' ? '↑' : '↓';
                    th.innerHTML += ` <span class="text-brand">${arrow}</span>`;
                }
            }
            
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = DOMUtils.createElement('tbody');
        
        if (pageData.length === 0) {
            const emptyRow = DOMUtils.createElement('tr');
            const emptyCell = DOMUtils.createElement('td', 
                'text-center p-8 text-gray-500', 
                this.options.emptyMessage
            );
            emptyCell.colSpan = this.columns.length;
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            pageData.forEach((item, index) => {
                const row = DOMUtils.createElement('tr', 'border-b hover:bg-gray-50');
                
                this.columns.forEach(col => {
                    const td = DOMUtils.createElement('td', 'p-4');
                    
                    if (col.render) {
                        td.innerHTML = col.render(item, index);
                    } else {
                        const value = this.getCellValue(item, col.key);
                        td.textContent = value || '-';
                    }
                    
                    row.appendChild(td);
                });
                
                tbody.appendChild(row);
            });
        }
        
        table.appendChild(tbody);
        
        // Limpiar container y añadir tabla
        this.container.innerHTML = '';
        this.container.appendChild(table);
        
        // Renderizar paginación si es necesaria
        if (this.options.paginate) {
            this.renderPagination();
        }
        
        return this;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.options.pageSize);
        if (totalPages <= 1) return;

        const pagination = DOMUtils.createElement('div', 'flex justify-center items-center space-x-2 mt-4');
        
        // Botón anterior
        const prevBtn = DOMUtils.createElement('button', 
            `px-3 py-1 rounded ${this.currentPage === 1 ? 'text-gray-400' : 'text-brand hover:bg-gray-100'}`,
            '← Anterior'
        );
        if (this.currentPage > 1) {
            prevBtn.addEventListener('click', () => {
                this.currentPage--;
                this.render();
            });
        }
        pagination.appendChild(prevBtn);

        // Números de página
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - this.currentPage) <= 2) {
                const pageBtn = DOMUtils.createElement('button',
                    `px-3 py-1 rounded ${i === this.currentPage ? 'bg-brand text-white' : 'hover:bg-gray-100'}`,
                    i.toString()
                );
                pageBtn.addEventListener('click', () => {
                    this.currentPage = i;
                    this.render();
                });
                pagination.appendChild(pageBtn);
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                pagination.appendChild(DOMUtils.createElement('span', 'px-2', '...'));
            }
        }

        // Botón siguiente
        const nextBtn = DOMUtils.createElement('button',
            `px-3 py-1 rounded ${this.currentPage === totalPages ? 'text-gray-400' : 'text-brand hover:bg-gray-100'}`,
            'Siguiente →'
        );
        if (this.currentPage < totalPages) {
            nextBtn.addEventListener('click', () => {
                this.currentPage++;
                this.render();
            });
        }
        pagination.appendChild(nextBtn);

        this.container.appendChild(pagination);
    }

    onRowClick(callback) {
        this.container.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.parentNode.tagName === 'TBODY') {
                const rowIndex = Array.from(row.parentNode.children).indexOf(row);
                const startIndex = (this.currentPage - 1) * this.options.pageSize;
                const dataIndex = startIndex + rowIndex;
                if (this.filteredData[dataIndex]) {
                    callback(this.filteredData[dataIndex], dataIndex, e);
                }
            }
        });
        return this;
    }
}

// === COMPONENTE CALENDARIO ===
class Calendar {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            startDate: new Date(),
            weekView: true,
            locale: 'es-ES',
            ...options
        };
        this.currentDate = new Date(this.options.startDate);
        this.events = [];
        this.onDayClickCallback = null;
        this.onEventClickCallback = null;
    }

    setEvents(events) {
        this.events = events;
        this.render();
        return this;
    }

    addEvent(event) {
        this.events.push(event);
        this.render();
        return this;
    }

    nextWeek() {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
        this.render();
        return this;
    }

    prevWeek() {
        this.currentDate.setDate(this.currentDate.getDate() - 7);
        this.render();
        return this;
    }

    goToDate(date) {
        this.currentDate = new Date(date);
        this.render();
        return this;
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';
        
        if (this.options.weekView) {
            this.renderWeekView();
        } else {
            this.renderMonthView();
        }
        
        return this;
    }

    renderWeekView() {
        const startOfWeek = DateUtils.getStartOfWeek(this.currentDate);
        const weekDays = DateUtils.getWeekdayNames();
        
        const weekContainer = DOMUtils.createElement('div', 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6');
        
        for (let i = 0; i < 5; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dayDateString = DateUtils.toDateString(dayDate);
            
            const dayColumn = DOMUtils.createElement('div');
            
            // Header del día
            const dayHeader = DOMUtils.createElement('h3', 
                'text-xl font-bold text-center mb-4 text-gray-600',
                `${weekDays[i]} <span class="text-sm font-normal">${dayDate.toLocaleDateString(this.options.locale, {day: '2-digit', month: '2-digit'})}</span>`
            );
            dayColumn.appendChild(dayHeader);
            
            // Eventos del día
            const dayEvents = this.events.filter(event => event.date === dayDateString);
            const eventsContainer = DOMUtils.createElement('div', 'space-y-4');
            
            if (dayEvents.length === 0) {
                eventsContainer.appendChild(
                    DOMUtils.createElement('div', 'text-center text-gray-400 mt-8', 'No hay eventos programados.')
                );
            } else {
                dayEvents
                    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                    .forEach(event => {
                        const eventCard = this.createEventCard(event);
                        eventsContainer.appendChild(eventCard);
                    });
            }
            
            dayColumn.appendChild(eventsContainer);
            weekContainer.appendChild(dayColumn);
        }
        
        this.container.appendChild(weekContainer);
    }

    createEventCard(event) {
        const card = DOMUtils.createElement('div', 
            'bg-white p-4 rounded-lg shadow-md border-l-4 cursor-pointer hover:shadow-lg transition-shadow'
        );
        
        // Color del evento
        const color = event.color || ColorUtils.getColorFromString(event.teacher || event.title);
        card.style.borderLeftColor = color;
        
        card.innerHTML = `
            <p class="font-bold text-lg text-gray-800">${event.title}</p>
            ${event.time ? `<p class="text-gray-500">${event.time}</p>` : ''}
            ${event.teacher ? `<p class="text-sm font-medium" style="color: ${color}">${event.teacher}</p>` : ''}
            ${event.subtitle ? `<p class="mt-2 text-sm text-gray-600">${event.subtitle}</p>` : ''}
        `;
        
        // Click handler
        card.addEventListener('click', (e) => {
            if (this.onEventClickCallback) {
                this.onEventClickCallback(event, e);
            }
        });
        
        return card;
    }

    onEventClick(callback) {
        this.onEventClickCallback = callback;
        return this;
    }

    onDayClick(callback) {
        this.onDayClickCallback = callback;
        return this;
    }
}

// === COMPONENTE SELECT MEJORADO ===
class EnhancedSelect {
    constructor(selectId, options = {}) {
        this.select = document.getElementById(selectId);
        this.options = {
            searchable: true,
            clearable: false,
            placeholder: 'Seleccionar...',
            noResultsText: 'No se encontraron resultados',
            ...options
        };
        this.isOpen = false;
        this.filteredOptions = [];
        this.selectedOption = null;
        
        if (this.select) {
            this.init();
        }
    }

    init() {
        this.createCustomSelect();
        this.setupEventListeners();
    }

    createCustomSelect() {
        // Ocultar select original
        this.select.style.display = 'none';
        
        // Crear wrapper
        this.wrapper = DOMUtils.createElement('div', 'relative');
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        
        // Crear input visual
        this.input = DOMUtils.createElement('input', 
            'w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer',
        );
        this.input.placeholder = this.options.placeholder;
        this.input.readOnly = !this.options.searchable;
        
        // Crear dropdown
        this.dropdown = DOMUtils.createElement('div', 
            'absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto hidden'
        );
        
        this.wrapper.appendChild(this.input);
        this.wrapper.appendChild(this.dropdown);
        
        this.updateOptions();
    }

    setupEventListeners() {
        // Toggle dropdown
        this.input.addEventListener('click', () => {
            if (!this.options.searchable) {
                this.toggle();
            }
        });

        // Búsqueda
        if (this.options.searchable) {
            this.input.addEventListener('input', (e) => {
                this.filter(e.target.value);
                if (!this.isOpen) this.show();
            });
        }

        // Cerrar al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.hide();
            }
        });

        // Navegación con teclado
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateOptions(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateOptions(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.selectFocusedOption();
            } else if (e.key === 'Escape') {
                this.hide();
            }
        });
    }

    updateOptions() {
        this.filteredOptions = Array.from(this.select.options).map(option => ({
            value: option.value,
            text: option.textContent,
            selected: option.selected,
            element: option
        }));
        
        this.renderOptions();
        
        // Actualizar input con selección actual
        const selected = this.filteredOptions.find(opt => opt.selected);
        if (selected) {
            this.input.value = selected.text;
            this.selectedOption = selected;
        }
    }

    filter(query) {
        const lowerQuery = query.toLowerCase();
        this.filteredOptions = Array.from(this.select.options)
            .map(option => ({
                value: option.value,
                text: option.textContent,
                selected: option.selected,
                element: option
            }))
            .filter(option => option.text.toLowerCase().includes(lowerQuery));
        
        this.renderOptions();
    }

    renderOptions() {
        this.dropdown.innerHTML = '';
        
        if (this.filteredOptions.length === 0) {
            const noResults = DOMUtils.createElement('div', 'p-2 text-gray-500 text-center', this.options.noResultsText);
            this.dropdown.appendChild(noResults);
            return;
        }
        
        this.filteredOptions.forEach(option => {
            const optionElement = DOMUtils.createElement('div', 
                `p-2 hover:bg-gray-100 cursor-pointer ${option.selected ? 'bg-brand text-white' : ''}`,
                option.text
            );
            
            optionElement.addEventListener('click', () => {
                this.selectOption(option);
            });
            
            this.dropdown.appendChild(optionElement);
        });
    }

    selectOption(option) {
        // Actualizar select original
        this.select.value = option.value;
        this.select.dispatchEvent(new Event('change'));
        
        // Actualizar UI
        this.input.value = option.text;
        this.selectedOption = option;
        
        this.hide();
    }

    show() {
        this.dropdown.classList.remove('hidden');
        this.isOpen = true;
    }

    hide() {
        this.dropdown.classList.add('hidden');
        this.isOpen = false;
    }

    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    setValue(value) {
        this.select.value = value;
        this.updateOptions();
    }

    getValue() {
        return this.select.value;
    }
}

// === COMPONENTE CARD ===
class Card {
    constructor(options = {}) {
        this.options = {
            className: 'bg-white rounded-lg shadow-md p-4',
            clickable: false,
            ...options
        };
    }

    createElement(content) {
        const card = DOMUtils.createElement('div', this.options.className);
        
        if (typeof content === 'string') {
            card.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            card.appendChild(content);
        }
        
        if (this.options.clickable) {
            card.classList.add('cursor-pointer', 'hover:shadow-lg', 'transition-shadow');
        }
        
        return card;
    }

    static createClassCard(classData, currentInscriptions, isFull) {
        const borderColor = isFull ? '#ef4444' : ColorUtils.getColorFromString(classData.teacher);
        
        const card = new Card({
            className: 'class-card bg-white p-4 rounded-lg shadow-md border-l-4 cursor-pointer hover:shadow-lg transition-shadow',
            clickable: true
        }).createElement(`
            <p class="font-bold text-lg text-gray-800">
                ${classData.name} 
                ${classData.type === 'one-off' ? '<span class="text-xs font-normal bg-gray-200 px-2 py-1 rounded-full">Puntual</span>' : ''}
            </p>
            <p class="text-gray-500">${classData.time}</p>
            ${classData.teacher ? `<p class="text-sm font-medium" style="color: ${borderColor}">${classData.teacher}</p>` : ''}
            <p class="mt-2 font-semibold ${isFull ? 'text-red-500' : 'text-gray-600'}">
                ${currentInscriptions} / ${classData.capacity} Plazas
            </p>
        `);
        
        card.style.borderLeftColor = borderColor;
        return card;
    }

    static createStudentCard(student) {
        return new Card({
            className: 'student-card bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500 hover:shadow-lg transition-shadow'
        }).createElement(`
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold text-lg text-gray-800">${student.name}</p>
                    <p class="text-gray-500">${student.email || 'Sin email'}</p>
                    ${student.phone ? `<p class="text-sm text-gray-600">${student.phone}</p>` : ''}
                </div>
                <div class="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center">
                    ${FormatUtils.getInitials(student.name)}
                </div>
            </div>
        `);
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.Modal = Modal;
    window.FormHandler = FormHandler;
    window.Table = Table;
    window.Calendar = Calendar;
    window.EnhancedSelect = EnhancedSelect;
    window.Card = Card;
}

// Para Node.js si algún día lo necesitas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Modal,
        FormHandler,
        Table,
        Calendar,
        EnhancedSelect,
        Card
    };
}