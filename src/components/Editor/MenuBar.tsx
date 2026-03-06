"use client";

import { Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";

interface MenuBarProps {
  editor: Editor | null;
  onImageUpload?: (file: File) => Promise<string>;
}

function MenuButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded-lg text-sm transition-all duration-150 min-w-[36px] h-[36px]
        flex items-center justify-center
        ${isActive
          ? "bg-primary/20 text-primary"
          : "text-gray-400 hover:text-white hover:bg-white/5"
        }
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-white/10 mx-1" />;
}

export default function MenuBar({ editor, onImageUpload }: MenuBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL odkazu:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (onImageUpload) {
      fileInputRef.current?.click();
    } else {
      const url = window.prompt("URL obrázku:");
      if (url) {
        editor?.chain().focus().setImage({ src: url }).run();
      }
    }
  }, [editor, onImageUpload]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImageUpload || !editor) return;
      try {
        const url = await onImageUpload(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch {
        alert("Nahrávání obrázku se nezdařilo");
      }
      e.target.value = "";
    },
    [editor, onImageUpload]
  );

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-white/10 bg-[#1a1e2e]/80 sticky top-0 z-10 backdrop-blur-sm">
      {/* Text formatting */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Tučně (Ctrl+B)"
      >
        <span className="font-bold">B</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Kurzíva (Ctrl+I)"
      >
        <span className="italic">I</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Podtržení (Ctrl+U)"
      >
        <span className="underline">U</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Přeškrtnutí"
      >
        <span className="line-through">S</span>
      </MenuButton>

      <Divider />

      {/* Headings */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Nadpis 2"
      >
        <span className="font-bold text-xs">H2</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Nadpis 3"
      >
        <span className="font-bold text-xs">H3</span>
      </MenuButton>

      <Divider />

      {/* Alignment */}
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Zarovnat vlevo"
      >
        ☰
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Zarovnat na střed"
      >
        ≡
      </MenuButton>

      <Divider />

      {/* Lists */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Odrážky"
      >
        •≡
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Číslovaný seznam"
      >
        1.
      </MenuButton>

      <Divider />

      {/* Block elements */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Citace"
      >
        „"
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Blok kódu"
      >
        {"</>"}
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Oddělovač"
      >
        ―
      </MenuButton>

      <Divider />

      {/* Link & Image */}
      <MenuButton
        onClick={addLink}
        isActive={editor.isActive("link")}
        title="Odkaz"
      >
        🔗
      </MenuButton>
      <MenuButton onClick={addImage} title="Obrázek">
        🖼️
      </MenuButton>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex-1" />

      {/* Undo/Redo */}
      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Zpět (Ctrl+Z)"
      >
        ↶
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Vpřed (Ctrl+Shift+Z)"
      >
        ↷
      </MenuButton>
    </div>
  );
}
