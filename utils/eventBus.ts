interface EventCallback {
    (data?: any): void;
}

interface RoleEventData {
    role: string;
    department: string;
    task?: string;
    source: 'dropdown' | 'url' | 'image' | 'window';
}

class EventBus {
    private events: { [key: string]: EventCallback[] } = {};

    on(event: string, callback: EventCallback): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    emit(event: string, data?: any): void {
        console.log(`🚍 [EventBus] Emitting event: ${event}`, data);
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    off(event: string, callback: EventCallback): void {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }

    // Clean up all listeners for debugging
    clear(): void {
        this.events = {};
    }

    // Get registered events for debugging
    getEvents(): string[] {
        return Object.keys(this.events);
    }

    // Get listener count for an event
    getListenerCount(event: string): number {
        return this.events[event] ? this.events[event].length : 0;
    }

    // Enhanced emit with validation for role selection
    emitRoleSelection(roleData: RoleEventData): void {
        // Ensure department is set for dropdown selections
        const processedRoleData: RoleEventData = {
            ...roleData,
            department: roleData.department || 'Favorite'
        };

        // Emit with proper validation
        this.emit(EVENT_TYPES.ROLE_SELECTED, processedRoleData);

        // Additional debugging for dropdown issues
        if (process.env.NODE_ENV === 'development') {
            console.log('🚌 Role Selection Event Emitted:', processedRoleData);
        }
    }

    // Enhanced emit for URL role selection
    emitRoleFromURL(roleData: RoleEventData): void {
        const processedRoleData: RoleEventData = {
            ...roleData,
            department: roleData.department || 'Favorite',
            source: 'url'
        };

        this.emit(EVENT_TYPES.ROLE_FROM_URL, processedRoleData);

        if (process.env.NODE_ENV === 'development') {
            console.log('🚌 URL Role Event Emitted:', processedRoleData);
        }
    }

    // Method to force expand pane update
    forceExpandPaneUpdate(roleData: RoleEventData): void {
        setTimeout(() => {
            this.emit(EVENT_TYPES.EXPAND_PANE_UPDATE, {
                breadcrumb: `Shop → ${roleData.department || 'Favorite'} → ${roleData.role}`,
                role: roleData
            });
        }, 0);
    }
}

export const eventBus = new EventBus();

export const EVENT_TYPES = {
    ROLE_SELECTED: 'roleSelected',
    ROLE_FROM_URL: 'roleFromURL',
    EXPAND_PANE_UPDATE: 'expandPaneUpdate',
    SHOP_EXPANDED: 'shopExpanded',
    SHOP_COLLAPSED: 'shopCollapsed',
    CATEGORY_CHANGED: 'categoryChanged'
} as const;

export type { RoleEventData, EventCallback };

// Development helper
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).eventBus = eventBus;
    console.log('EventBus available at window.eventBus for debugging');
}
