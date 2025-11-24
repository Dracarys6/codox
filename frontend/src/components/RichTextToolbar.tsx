import { Editor } from '@tiptap/react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import clsx from 'clsx';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Highlighter,
    List,
    ListOrdered,
    Quote,
    Code2,
    Link2,
    Image as ImageIcon,
    Undo2,
    Redo2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Palette,
    Heading1,
    Heading2,
    Heading3,
    FileText,
    Type,
    Clock3,
} from 'lucide-react';

interface RichTextToolbarProps {
    editor: Editor | null;
}

export function RichTextToolbar({ editor }: RichTextToolbarProps) {
    const [colorValue, setColorValue] = useState('#000000');
    const [stats, setStats] = useState({ words: 0, chars: 0 });

    const headingLevels = useMemo(
        () => [
            { label: '正文', level: 0 },
            { label: 'H1', level: 1 },
            { label: 'H2', level: 2 },
            { label: 'H3', level: 3 },
        ],
        []
    );

    useEffect(() => {
        if (!editor) return;
        const handleSelection = () => {
            const currentColor = (editor.getAttributes('textStyle').color as string | undefined) || '#000000';
            setColorValue(currentColor);
        };
        const handleContentStats = () => {
            const text = editor.getText();
            const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
            const chars = text.length;
            setStats({ words, chars });
        };
        editor.on('selectionUpdate', handleSelection);
        editor.on('update', handleContentStats);
        handleSelection();
        handleContentStats();
        return () => {
            editor.off('selectionUpdate', handleSelection);
            editor.off('update', handleContentStats);
        };
    }, [editor]);

    const applyHeading = (level: number) => {
        if (!editor) return;
        if (level === 0) {
            editor.chain().focus().setParagraph().run();
            return;
        }
        editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    };

    const promptForLink = () => {
        if (!editor) return;
        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('请输入链接地址（留空移除链接）', previous || 'https://');
        if (url === null) return;
        if (url.trim() === '') {
            editor.chain().focus().unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim(), target: '_blank' }).run();
    };

    const promptForImage = () => {
        if (!editor) return;
        const url = window.prompt('请输入图片地址');
        if (!url) return;
        editor.chain().focus().setImage({ src: url.trim() }).run();
    };

    const updateColor = (value: string) => {
        if (!editor) return;
        setColorValue(value);
        editor.chain().focus().setColor(value).run();
    };

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
                <Dropdown
                    label="段落"
                    value={(() => {
                        const currentLevel = headingLevels.find(({ level }) => editor.isActive('heading', { level }))?.level;
                        return currentLevel !== undefined ? currentLevel : 0;
                    })()}
                    options={headingLevels.map((item) => ({
                        value: item.level,
                        label: item.label,
                    }))}
                    onChange={(value) => applyHeading(Number(value))}
                />
                <ToolbarButton
                    icon={Heading1}
                    label="H1"
                    active={editor.isActive('heading', { level: 1 })}
                    onClick={() => applyHeading(1)}
                />
                <ToolbarButton
                    icon={Heading2}
                    label="H2"
                    active={editor.isActive('heading', { level: 2 })}
                    onClick={() => applyHeading(2)}
                />
                <ToolbarButton
                    icon={Heading3}
                    label="H3"
                    active={editor.isActive('heading', { level: 3 })}
                    onClick={() => applyHeading(3)}
                />
                <Divider />
                <ToolbarButton
                    icon={Bold}
                    label="加粗"
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <ToolbarButton
                    icon={Italic}
                    label="斜体"
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <ToolbarButton
                    icon={UnderlineIcon}
                    label="下划线"
                    active={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
                <ToolbarButton
                    icon={Strikethrough}
                    label="删除线"
                    active={editor.isActive('strike')}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                />
                <ToolbarButton
                    icon={Highlighter}
                    label="高亮"
                    active={editor.isActive('highlight')}
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                />
                <ColorPicker colorValue={colorValue} onChange={updateColor} />
                <Divider />
                <ToolbarButton
                    icon={List}
                    label="无序列表"
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
                <ToolbarButton
                    icon={ListOrdered}
                    label="有序列表"
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
                <ToolbarButton
                    icon={Quote}
                    label="引用"
                    active={editor.isActive('blockquote')}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                />
                <ToolbarButton
                    icon={Code2}
                    label="代码块"
                    active={editor.isActive('codeBlock')}
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                />
                <Divider />
                <ToolbarButton icon={Link2} label="链接" active={editor.isActive('link')} onClick={promptForLink} />
                <ToolbarButton icon={ImageIcon} label="图片" onClick={promptForImage} />
                <Divider />
                <ToolbarButton icon={Undo2} label="撤销" onClick={() => editor.chain().focus().undo().run()} />
                <ToolbarButton icon={Redo2} label="重做" onClick={() => editor.chain().focus().redo().run()} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
                {[
                    { align: 'left', Icon: AlignLeft, label: '左对齐' },
                    { align: 'center', Icon: AlignCenter, label: '居中' },
                    { align: 'right', Icon: AlignRight, label: '右对齐' },
                    { align: 'justify', Icon: AlignJustify, label: '两端对齐' },
                ].map(({ align, Icon, label }) => (
                    <ToolbarButton
                        key={align}
                        icon={Icon}
                        label={label}
                        active={editor.isActive({ textAlign: align })}
                        onClick={() => editor.chain().focus().setTextAlign(align as any).run()}
                    />
                ))}
            </div>
            <StatusBar stats={stats} />
        </div>
    );
}

interface ToolbarButtonProps {
    onClick: () => void;
    label: string;
    active?: boolean;
    icon?: ComponentType<{ className?: string }>;
}

function ToolbarButton({ onClick, label, active = false, icon: Icon }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className={clsx(
                'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
            )}
        >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

interface DropdownProps {
    value: number;
    options: { value: number; label: string }[];
    onChange: (value: number) => void;
    label: string;
}

function Dropdown({ value, options, onChange }: DropdownProps) {
    return (
        <select
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700"
            value={value}
            title="段落样式"
            onChange={(event) => onChange(Number(event.target.value))}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function Divider() {
    return <span className="h-6 w-px bg-gray-300" />;
}

interface ColorPickerProps {
    colorValue: string;
    onChange: (value: string) => void;
}

function ColorPicker({ colorValue, onChange }: ColorPickerProps) {
    return (
        <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
            <Palette className="h-4 w-4 text-gray-500" />
            <input
                type="color"
                value={colorValue}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-gray-200 bg-white"
                title="文字颜色"
            />
        </label>
    );
}

interface StatusBarProps {
    stats: { words: number; chars: number };
}

function StatusBar({ stats }: StatusBarProps) {
    return (
        <div className="mt-1 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
            <StatusItem icon={FileText} label="字数" value={stats.words.toString()} />
            <StatusItem icon={Type} label="字符" value={stats.chars.toString()} />
            <StatusItem icon={Clock3} label="阅读" value={`${Math.max(1, Math.round(stats.words / 200))} min`} />
        </div>
    );
}

interface StatusItemProps {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
}

function StatusItem({ icon: Icon, label, value }: StatusItemProps) {
    return (
        <span className="flex items-center gap-1">
            <Icon className="h-4 w-4 text-gray-400" />
            <span>{label}:</span>
            <strong className="text-gray-700">{value}</strong>
        </span>
    );
}

