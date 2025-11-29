import { Extension } from '@tiptap/core';
import { DecorationAttrs } from '@tiptap/pm/view';
import { defaultSelectionBuilder, yCursorPlugin } from '@tiptap/y-tiptap';

type CollaborationCursorStorage = {
    users: { clientId: number; [key: string]: any }[];
};

export interface CollaborationCursorOptions {
    provider: any;
    user: Record<string, any>;
    render: (user: Record<string, any>) => HTMLElement;
    selectionRender: (user: Record<string, any>) => DecorationAttrs;
}

const awarenessStatesToArray = (states: Map<number, Record<string, any>>) => {
    return Array.from(states.entries()).map(([key, value]) => ({
        clientId: key,
        ...value.user,
    }));
};

const defaultRender = (user: Record<string, any>) => {
    const cursor = document.createElement('span');
    cursor.classList.add('collaboration-cursor__caret');
    cursor.setAttribute('style', `border-color: ${user.color}`);

    const label = document.createElement('div');
    label.classList.add('collaboration-cursor__label');
    label.setAttribute('style', `background-color: ${user.color}`);
    label.insertBefore(document.createTextNode(user.name), null);
    cursor.insertBefore(label, null);

    return cursor;
};

export const CollaborationCursor = Extension.create<Partial<CollaborationCursorOptions>, CollaborationCursorStorage>({
    name: 'collaborationCursor',

    addOptions() {
        return {
            provider: null,
            user: {
                name: null,
                color: null,
            },
            render: defaultRender,
            selectionRender: defaultSelectionBuilder,
        };
    },

    addStorage() {
        return {
            users: [],
        };
    },

    addCommands() {
        return {
            updateUser:
                (attributes: Record<string, any>) =>
                () => {
                    this.options.user = attributes;
                    this.options.provider?.awareness?.setLocalStateField('user', this.options.user);
                    return true;
                },
        };
    },

    addProseMirrorPlugins() {
        if (!this.options.provider) {
            console.warn('[collaborationCursor] provider is required.');
            return [];
        }

        return [
            yCursorPlugin(
                (() => {
                    this.options.provider.awareness.setLocalStateField('user', this.options.user);
                    this.storage.users = awarenessStatesToArray(this.options.provider.awareness.states);
                    this.options.provider.awareness.on('update', () => {
                        this.storage.users = awarenessStatesToArray(this.options.provider.awareness.states);
                    });
                    return this.options.provider.awareness;
                })(),
                {
                    cursorBuilder: this.options.render!,
                    selectionBuilder: this.options.selectionRender!,
                }
            ),
        ];
    },
});

