// utils.js - Funciones utilitarias para la aplicación

// === UTILIDADES DE FECHA ===
const DateUtils = {
    /**
     * Obtiene el inicio de la semana (lunes) para una fecha dada
     * @param {Date} date 
     * @returns {Date}
     */
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    /**
     * Convierte una fecha a string YYYY-MM-DD
     * @param {Date} date 
     * @returns {string}
     */
    toDateString(date) {
        return date.toISOString().split('T')[0];
    },

    /**
     * Verifica si una fecha es hoy
     * @param {string|Date} date 
     * @returns {boolean}
     */
    isToday(date) {
        const today = new Date();
        const compareDate = typeof date === 'string' ? new Date(date) : date;
        return this.toDateString(today) === this.toDateString(compareDate);
    },

    /**
     * Verifica si una fecha es futura
     * @param {string|Date} date 
     * @returns {boolean}
     */
    isFuture(date) {
        const today = new Date();
        const compareDate = typeof date === 'string' ? new Date(date) : date;
        return compareDate > today;
    },

    /**
     * Obtiene el nombre del día en español
     * @param {number} dayNumber - 0=Domingo, 1=Lunes, etc.
     * @returns {string}
     */
    getDayName(dayNumber) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[dayNumber] || '';
    },

    /**
     * Obtiene los nombres de días laborables
     * @returns {string[]}
     */
    getWeekdayNames() {
        return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    },

    /**
     * Formatea una fecha para mostrar al usuario
     * @param {string|Date} date 
     * @returns {string}
     */
    formatDisplayDate(date) {
        const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
        return d.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }
};

// === UTILIDADES DE VALIDACIÓN ===
const ValidationUtils = {
    /**
     * Valida formato de email
     * @param {string} email 
     * @returns {boolean}
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Valida formato de teléfono español
     * @param {string} phone 
     * @returns {boolean}
     */
    isValidPhone(phone) {
        const phoneRegex = /^(\+34\s?)?[6-9]\d{8}$/;
        const cleanPhone = phone.replace(/\s/g, '');
        return phoneRegex.test(cleanPhone);
    },

    /**
     * Valida formato de hora HH:MM
     * @param {string} time 
     * @returns {boolean}
     */
    isValidTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    },

    /**
     * Valida formato de fecha YYYY-MM-DD
     * @param {string} date 
     * @returns {boolean}
     */
    isValidDate(date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) return false;
        
        const parsedDate = new Date(date);
        return parsedDate instanceof Date && !isNaN(parsedDate);
    },

    /**
     * Sanitiza un string eliminando espacios y caracteres especiales
     * @param {string} str 
     * @returns {string}
     */
    sanitizeString(str) {
        return str ? str.trim().replace(/[<>]/g, '') : '';
    },

    /**
     * Valida que un string no esté vacío después de sanitizar
     * @param {string} str 
     * @param {number} maxLength 
     * @returns {object}
     */
    validateString(str, maxLength = 100) {
        const sanitized = this.sanitizeString(str);
        return {
            isValid: sanitized.length > 0 && sanitized.length <= maxLength,
            value: sanitized,
            error: sanitized.length === 0 ? 'Campo obligatorio' : 
                   sanitized.length > maxLength ? `Máximo ${maxLength} caracteres` : null
        };
    }
};

// === UTILIDADES DE DOM ===
const DOMUtils = {
    /**
     * Crea un elemento con clases y contenido
     * @param {string} tag 
     * @param {string} className 
     * @param {string} innerHTML 
     * @returns {HTMLElement}
     */
    createElement(tag, className = '', innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    },

    /**
     * Encuentra el ancestro más cercano con una clase específica
     * @param {HTMLElement} element 
     * @param {string} className 
     * @returns {HTMLElement|null}
     */
    findAncestor(element, className) {
        let current = element;
        while (current && !current.classList.contains(className)) {
            current = current.parentElement;
        }
        return current;
    },

    /**
     * Muestra/oculta un modal
     * @param {HTMLElement} modal 
     * @param {boolean} show 
     */
    toggleModal(modal, show = true) {
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    /**
     * Limpia un formulario
     * @param {HTMLFormElement} form 
     */
    clearForm(form) {
        form.reset();
        // Limpiar también campos hidden
        const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
        hiddenInputs.forEach(input => input.value = '');
    },

    /**
     * Obtiene los datos de un formulario como objeto
     * @param {HTMLFormElement} form 
     * @returns {object}
     */
    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    },

    /**
     * Rellena un formulario con datos
     * @param {HTMLFormElement} form 
     * @param {object} data 
     */
    populateForm(form, data) {
        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"], #${key}`);
            if (input) {
                input.value = data[key] || '';
            }
        });
    }
};

// === UTILIDADES DE COLOR ===
const ColorUtils = {
    /**
     * Genera un color consistente basado en un string
     * @param {string} str 
     * @returns {string} - Color HSL
     */
    getColorFromString(str) {
        if (!str) return '#C0A164';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${hash % 360}, 60%, 75%)`;
    },

    /**
     * Convierte HSL a HEX
     * @param {string} hsl 
     * @returns {string}
     */
    hslToHex(hsl) {
        // Implementación simplificada para los casos básicos
        const values = hsl.match(/\d+/g);
        if (!values || values.length < 3) return '#C0A164';
        
        const h = parseInt(values[0]) / 360;
        const s = parseInt(values[1]) / 100;
        const l = parseInt(values[2]) / 100;
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
};

// === UTILIDADES DE FORMATO ===
const FormatUtils = {
    /**
     * Capitaliza la primera letra de cada palabra
     * @param {string} str 
     * @returns {string}
     */
    capitalize(str) {
        return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    },

    /**
     * Obtiene las iniciales de un nombre
     * @param {string} name 
     * @param {number} maxInitials 
     * @returns {string}
     */
    getInitials(name, maxInitials = 2) {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, maxInitials);
    },

    /**
     * Formatea un número como porcentaje
     * @param {number} value 
     * @param {number} total 
     * @returns {string}
     */
    formatPercentage(value, total) {
        if (total === 0) return '0%';
        return Math.round((value / total) * 100) + '%';
    },

    /**
     * Formatea un precio en euros
     * @param {number} amount 
     * @returns {string}
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    },

    /**
     * Trunca un texto si es muy largo
     * @param {string} text 
     * @param {number} maxLength 
     * @returns {string}
     */
    truncate(text, maxLength = 50) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
};

// === UTILIDADES DE FILTRO Y BÚSQUEDA ===
const SearchUtils = {
    /**
     * Normaliza un string para búsqueda (sin tildes, minúsculas)
     * @param {string} str 
     * @returns {string}
     */
    normalize(str) {
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    /**
     * Busca en múltiples campos de un objeto
     * @param {object} item 
     * @param {string[]} fields 
     * @param {string} query 
     * @returns {boolean}
     */
    searchInFields(item, fields, query) {
        const normalizedQuery = this.normalize(query);
        return fields.some(field => {
            const value = item[field];
            if (!value) return false;
            return this.normalize(value.toString()).includes(normalizedQuery);
        });
    },

    /**
     * Filtra una lista de estudiantes por query
     * @param {object[]} students 
     * @param {string} query 
     * @returns {object[]}
     */
    filterStudents(students, query) {
        if (!query.trim()) return students;
        return students.filter(student => 
            this.searchInFields(student, ['name', 'email'], query)
        );
    },

    /**
     * Filtra una lista de profesores por query
     * @param {object[]} teachers 
     * @param {string} query 
     * @returns {object[]}
     */
    filterTeachers(teachers, query) {
        if (!query.trim()) return teachers;
        return teachers.filter(teacher => 
            this.searchInFields(teacher, ['name', 'email'], query) ||
            (teacher.specialties && teacher.specialties.some(specialty => 
                this.normalize(specialty).includes(this.normalize(query))
            ))
        );
    }
};

// === UTILIDADES DE NOTIFICACIÓN ===
const NotificationUtils = {
    /**
     * Muestra una notificación temporal
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - duración en ms
     */
    show(message, type = 'info', duration = 3000) {
        // Crear elemento de notificación si no existe
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = DOMUtils.createElement('div', 'fixed top-4 right-4 z-50 space-y-2');
            container.id = 'notifications-container';
            document.body.appendChild(container);
        }

        const colorClasses = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-black',
            info: 'bg-blue-500 text-white'
        };

        const notification = DOMUtils.createElement('div', 
            `${colorClasses[type]} px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300 translate-x-full`,
            message
        );

        container.appendChild(notification);

        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);

        // Remover después del duration
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    },

    success(message, duration) {
        this.show(message, 'success', duration);
    },

    error(message, duration) {
        this.show(message, 'error', duration);
    },

    warning(message, duration) {
        this.show(message, 'warning', duration);
    },

    info(message, duration) {
        this.show(message, 'info', duration);
    }
};

// === UTILIDADES DE DATOS ===
const DataUtils = {
    /**
     * Agrupa un array por una clave
     * @param {object[]} array 
     * @param {string} key 
     * @returns {object}
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const value = item[key];
            if (!groups[value]) {
                groups[value] = [];
            }
            groups[value].push(item);
            return groups;
        }, {});
    },

    /**
     * Ordena un array por una clave
     * @param {object[]} array 
     * @param {string} key 
     * @param {boolean} ascending 
     * @returns {object[]}
     */
    sortBy(array, key, ascending = true) {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        });
    },

    /**
     * Cuenta elementos únicos por una clave
     * @param {object[]} array 
     * @param {string} key 
     * @returns {object}
     */
    countBy(array, key) {
        return array.reduce((counts, item) => {
            const value = item[key];
            counts[value] = (counts[value] || 0) + 1;
            return counts;
        }, {});
    },

    /**
     * Obtiene valores únicos de una clave en un array
     * @param {object[]} array 
     * @param {string} key 
     * @returns {any[]}
     */
    uniqueBy(array, key) {
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    }
};

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.DateUtils = DateUtils;
    window.ValidationUtils = ValidationUtils;
    window.DOMUtils = DOMUtils;
    window.ColorUtils = ColorUtils;
    window.FormatUtils = FormatUtils;
    window.SearchUtils = SearchUtils;
    window.NotificationUtils = NotificationUtils;
    window.DataUtils = DataUtils;
}

// Para Node.js si algún día lo necesitas
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DateUtils,
        ValidationUtils,
        DOMUtils,
        ColorUtils,
        FormatUtils,
        SearchUtils,
        NotificationUtils,
        DataUtils
    };
}