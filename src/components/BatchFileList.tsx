import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ImageIcon, FileText } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUi } from "@/components/ui-context";
import { MAX_IMAGES, MAX_BATCH_FILES, type BatchType } from "@/lib/constants";
import { getFileExtension, getExtColor } from "@/lib/utils";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/bmp";

interface BatchFileListProps {
  batchType: BatchType | null;
  files: File[];
  onReorder: (files: File[]) => void;
  onReplace: (index: number, file: File) => void;
  onDelete: (index: number) => void;
  onAdd: (files: File[]) => void;
  limitReached: boolean;
  accept?: string;
  supportedExts?: string[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  allowDocReplace?: boolean;
}

interface RowProps {
  batchType: BatchType | null;
  file: File;
  index: number;
  id: string;
  onReplace: (index: number, file: File) => void;
  onDelete: (index: number) => void;
  onExternalDragOver: (
    e: React.DragEvent,
    zone: "replace" | "insert-before",
  ) => void;
  onExternalDrop: (
    e: React.DragEvent,
    zone: "replace" | "insert-before",
    index: number,
  ) => void;
  onExternalDragLeave: () => void;
  dropTarget: {
    type: "replace" | "insert-before" | "add";
    index: number;
  } | null;
  accept?: string;
  selected?: boolean;
  onSelect?: () => void;
  allowDocReplace?: boolean;
}

function SortableFileRow({
  batchType,
  file,
  index,
  id,
  onReplace,
  onDelete,
  onExternalDragOver,
  onExternalDrop,
  onExternalDragLeave,
  dropTarget,
  accept,
  selected,
  onSelect,
  allowDocReplace,
}: RowProps) {
  const { t } = useTranslation();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isReplaceTarget =
    dropTarget?.type === "replace" && dropTarget.index === index;
  const isInsertTarget =
    dropTarget?.type === "insert-before" && dropTarget.index === index;

  const isImage = batchType === "image";
  const ext = isImage ? "" : getFileExtension(file.name);

  const thumbnailUrl = useMemo(
    () => (isImage ? URL.createObjectURL(file) : ""),
    [file, isImage],
  );
  useEffect(() => {
    if (thumbnailUrl) return () => URL.revokeObjectURL(thumbnailUrl);
    return undefined;
  }, [thumbnailUrl]);

  const replaceAccept = isImage
    ? allowDocReplace
      ? undefined
      : IMAGE_ACCEPT
    : accept;

  const replaceLabel = isImage
    ? t("printer.replaceImage")
    : t("printer.replaceFile");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors ${isImage ? "" : "cursor-pointer"}
        ${
          isReplaceTarget
            ? "border-orange-400 bg-orange-50 ring-2 ring-orange-300"
            : isInsertTarget
              ? "border-blue-400 bg-white ring-2 ring-blue-300 border-t-4 border-t-blue-500"
              : selected
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      onClick={() => !isImage && onSelect?.()}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const zone =
          e.clientY < rect.top + rect.height / 2 ? "insert-before" : "replace";
        onExternalDragOver(e, zone);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const zone =
          e.clientY < rect.top + rect.height / 2 ? "insert-before" : "replace";
        onExternalDrop(e, zone, index);
      }}
      onDragLeave={onExternalDragLeave}
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {isImage ? (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
          <img
            src={thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${getExtColor(ext)}`}
        >
          {ext.toUpperCase() || <FileText className="w-5 h-5" />}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {file.name}
        </p>
        <p className="text-xs text-gray-400">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>

      <button
        type="button"
        className="text-xs text-blue-600 hover:text-blue-800 shrink-0 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        onClick={() => replaceInputRef.current?.click()}
      >
        {replaceLabel}
      </button>
      <input
        ref={replaceInputRef}
        type="file"
        accept={replaceAccept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplace(index, f);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        className="text-gray-400 hover:text-red-500 shrink-0 transition-colors"
        onClick={() => onDelete(index)}
      >
        <X className="w-4 h-4" />
      </button>

      {(isReplaceTarget || isInsertTarget) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`text-white text-xs font-semibold px-2 py-1 rounded-full shadow ${isReplaceTarget ? "bg-orange-500" : "bg-blue-500"}`}
          >
            {isReplaceTarget
              ? isImage
                ? t("printer.dropToReplace")
                : t("printer.dropToReplaceFile")
              : isImage
                ? t("printer.dropToInsert")
                : t("printer.dropToInsertFile")}
          </span>
        </div>
      )}
    </div>
  );
}

const fileIdCache = new WeakMap<File, string>();

export default function BatchFileList({
  batchType,
  files,
  onReorder,
  onReplace,
  onDelete,
  onAdd,
  limitReached,
  accept,
  supportedExts,
  selectedIndex,
  onSelect,
  allowDocReplace,
}: BatchFileListProps) {
  const { t } = useTranslation();
  const { toast } = useUi();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [dropTarget, setDropTarget] = useState<{
    type: "replace" | "insert-before" | "add";
    index: number;
  } | null>(null);

  const isImage = batchType === "image";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const ids = useMemo(
    () =>
      files.map((file) => {
        if (!fileIdCache.has(file)) {
          fileIdCache.set(file, crypto.randomUUID());
        }
        return fileIdCache.get(file)!;
      }),
    [files],
  );

  const isDocExt = useCallback(
    (f: File) => {
      if (!supportedExts) return false;
      const ext = getFileExtension(f.name);
      return supportedExts.includes(ext);
    },
    [supportedExts],
  );

  const isValidFile = useCallback(
    (f: File) =>
      batchType === null
        ? f.type.startsWith("image/") || isDocExt(f)
        : isImage
          ? f.type.startsWith("image/")
          : isDocExt(f),
    [isImage, isDocExt, batchType],
  );

  const maxCount = isImage ? MAX_IMAGES : MAX_BATCH_FILES;
  const limitMsg = isImage
    ? t("printer.imageLimitReached")
    : t("printer.batchFileLimitReached");
  const typeRejectMsg =
    batchType === null
      ? t("printer.mixedTypesRejected")
      : isImage
        ? t("printer.imageOnlyBatch")
        : t("printer.docOnlyBatch");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      onReorder(arrayMove(files, oldIndex, newIndex));
    }
  };

  const handleExternalDragOver = useCallback(
    (e: React.DragEvent, zone: "replace" | "insert-before", index?: number) => {
      e.preventDefault();
      setDropTarget(index !== undefined ? { type: zone, index } : null);
    },
    [],
  );

  const handleExternalDrop = useCallback(
    (e: React.DragEvent, zone: "replace" | "insert-before", index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);

      const isReplaceAllowed = zone === "replace" && isImage && allowDocReplace;
      const totalFiles = Array.from(e.dataTransfer.files);
      const incoming = isReplaceAllowed
        ? totalFiles
        : totalFiles.filter(isValidFile);
      if (!incoming.length) {
        if (totalFiles.length > 0 && !isReplaceAllowed) {
          toast({ message: typeRejectMsg, type: "error" });
        }
        return;
      }

      if (zone === "replace") {
        onReplace(index, incoming[0]);
      } else {
        const available = maxCount - files.length;
        if (available <= 0) {
          toast({ message: limitMsg, type: "error" });
          return;
        }
        const toInsert = incoming.slice(0, available);
        if (incoming.length > available) {
          toast({ message: limitMsg, type: "error" });
        }
        const next = [...files];
        next.splice(index, 0, ...toInsert);
        onReorder(next);
      }
    },
    [
      files,
      isImage,
      allowDocReplace,
      isValidFile,
      maxCount,
      limitMsg,
      typeRejectMsg,
      onReplace,
      onReorder,
      toast,
    ],
  );

  const handleAddZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      const totalFiles = Array.from(e.dataTransfer.files);
      const incoming = totalFiles.filter(isValidFile);
      if (incoming.length) {
        onAdd(incoming);
      } else if (totalFiles.length > 0) {
        toast({ message: typeRejectMsg, type: "error" });
      }
    },
    [onAdd, isValidFile, typeRejectMsg, toast],
  );

  const addAccept = isImage ? IMAGE_ACCEPT : accept;
  const addLabel = isImage
    ? "+ " + t("printer.addMoreImages")
    : "+ " + t("printer.addMoreFiles");
  const countLabel =
    batchType === null
      ? t("printer.fileCount", { count: files.length })
      : isImage
        ? t("printer.imageCount", { count: files.length })
        : t("printer.fileCount", { count: files.length });
  const dropAddLabel = isImage
    ? t("printer.dropToAdd")
    : t("printer.dropToAddFile");
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <div className="flex flex-col flex-1 max-h-[400px]">
      <div className="overflow-y-auto flex-1 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {files.map((file, index) => (
              <SortableFileRow
                key={ids[index]}
                batchType={batchType}
                id={ids[index]}
                file={file}
                index={index}
                onReplace={onReplace}
                onDelete={onDelete}
                onExternalDragOver={(e, zone) =>
                  handleExternalDragOver(e, zone, index)
                }
                onExternalDrop={handleExternalDrop}
                onExternalDragLeave={() => setDropTarget(null)}
                dropTarget={dropTarget}
                accept={accept}
                selected={selectedIndex === index}
                onSelect={() => onSelect?.(index)}
                allowDocReplace={allowDocReplace}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div
        className={`mt-2 shrink-0 flex items-center justify-between p-3 rounded-xl border-2 border-dashed transition-colors
          ${dropTarget?.type === "add" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropTarget({ type: "add", index: -1 });
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={handleAddZoneDrop}
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Icon className="w-4 h-4" />
          <span>{countLabel}</span>
          {dropTarget?.type === "add" && (
            <span className="text-blue-600 font-medium">{dropAddLabel}</span>
          )}
        </div>
        {!limitReached && (
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            onClick={() => addInputRef.current?.click()}
          >
            {addLabel}
          </button>
        )}
        <input
          ref={addInputRef}
          type="file"
          accept={addAccept}
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            if (picked.length) onAdd(picked);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
