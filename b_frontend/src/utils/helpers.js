import { FileText, Image, Code, Music, Video, Archive, File, Database } from 'lucide-react';

const TYPE_MAP = {
  // Imagens
  jpg:  { icon: Image,    color: 'text-green-500',   bg: 'bg-green-50'   },
  jpeg: { icon: Image,    color: 'text-green-500',   bg: 'bg-green-50'   },
  png:  { icon: Image,    color: 'text-green-500',   bg: 'bg-green-50'   },
  gif:  { icon: Image,    color: 'text-green-500',   bg: 'bg-green-50'   },
  svg:  { icon: Image,    color: 'text-green-600',   bg: 'bg-green-50'   },
  webp: { icon: Image,    color: 'text-green-500',   bg: 'bg-green-50'   },
  bmp:  { icon: Image,    color: 'text-green-400',   bg: 'bg-green-50'   },

  // PDFs
  pdf:  { icon: FileText, color: 'text-red-500',     bg: 'bg-red-50'     },

  // Documentos
  doc:  { icon: FileText, color: 'text-blue-500',    bg: 'bg-blue-50'    },
  docx: { icon: FileText, color: 'text-blue-500',    bg: 'bg-blue-50'    },
  odt:  { icon: FileText, color: 'text-blue-400',    bg: 'bg-blue-50'    },
  txt:  { icon: FileText, color: 'text-gray-500',    bg: 'bg-gray-100'   },
  md:   { icon: FileText, color: 'text-gray-600',    bg: 'bg-gray-100'   },
  rtf:  { icon: FileText, color: 'text-gray-500',    bg: 'bg-gray-100'   },

  // Planilhas
  xls:  { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  xlsx: { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  csv:  { icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ods:  { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-50' },

  // Código
  js:   { icon: Code,     color: 'text-yellow-500',  bg: 'bg-yellow-50'  },
  ts:   { icon: Code,     color: 'text-blue-600',    bg: 'bg-blue-50'    },
  jsx:  { icon: Code,     color: 'text-cyan-500',    bg: 'bg-cyan-50'    },
  tsx:  { icon: Code,     color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
  py:   { icon: Code,     color: 'text-blue-500',    bg: 'bg-blue-50'    },
  java: { icon: Code,     color: 'text-orange-500',  bg: 'bg-orange-50'  },
  html: { icon: Code,     color: 'text-orange-400',  bg: 'bg-orange-50'  },
  css:  { icon: Code,     color: 'text-blue-400',    bg: 'bg-blue-50'    },
  json: { icon: Code,     color: 'text-yellow-600',  bg: 'bg-yellow-50'  },
  php:  { icon: Code,     color: 'text-purple-500',  bg: 'bg-purple-50'  },
  rb:   { icon: Code,     color: 'text-red-400',     bg: 'bg-red-50'     },
  go:   { icon: Code,     color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
  rs:   { icon: Code,     color: 'text-orange-600',  bg: 'bg-orange-50'  },
  c:    { icon: Code,     color: 'text-indigo-500',  bg: 'bg-indigo-50'  },
  cpp:  { icon: Code,     color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
  sh:   { icon: Code,     color: 'text-green-600',   bg: 'bg-green-50'   },
  sql:  { icon: Database, color: 'text-indigo-500',  bg: 'bg-indigo-50'  },

  // Áudio
  mp3:  { icon: Music,    color: 'text-purple-500',  bg: 'bg-purple-50'  },
  wav:  { icon: Music,    color: 'text-purple-500',  bg: 'bg-purple-50'  },
  flac: { icon: Music,    color: 'text-purple-600',  bg: 'bg-purple-50'  },
  ogg:  { icon: Music,    color: 'text-purple-400',  bg: 'bg-purple-50'  },
  aac:  { icon: Music,    color: 'text-purple-400',  bg: 'bg-purple-50'  },

  // Vídeo
  mp4:  { icon: Video,    color: 'text-pink-500',    bg: 'bg-pink-50'    },
  avi:  { icon: Video,    color: 'text-pink-500',    bg: 'bg-pink-50'    },
  mov:  { icon: Video,    color: 'text-pink-600',    bg: 'bg-pink-50'    },
  mkv:  { icon: Video,    color: 'text-pink-500',    bg: 'bg-pink-50'    },
  webm: { icon: Video,    color: 'text-pink-400',    bg: 'bg-pink-50'    },

  // Compactados
  zip:  { icon: Archive,  color: 'text-amber-500',   bg: 'bg-amber-50'   },
  rar:  { icon: Archive,  color: 'text-amber-500',   bg: 'bg-amber-50'   },
  tar:  { icon: Archive,  color: 'text-amber-500',   bg: 'bg-amber-50'   },
  gz:   { icon: Archive,  color: 'text-amber-400',   bg: 'bg-amber-50'   },
  '7z': { icon: Archive,  color: 'text-amber-600',   bg: 'bg-amber-50'   },

  // Banco de dados
  db:   { icon: Database, color: 'text-indigo-500',  bg: 'bg-indigo-50'  },
};

export function getFileTypeInfo(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return TYPE_MAP[ext] || { icon: File, color: 'text-gray-400', bg: 'bg-gray-100' };
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

export function isImageFile(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return IMAGE_EXTS.has(ext);
}

export function getFileUrl(file) {
  // Backend now returns a pre-built `url` field scoped to the user
  if (file.url) return file.url;
  // Fallback for legacy data without url field
  if (file.folder) {
    return `/files/${encodeURIComponent(file.folder)}/${encodeURIComponent(file.name)}`;
  }
  return `/files/${encodeURIComponent(file.name)}`;
}

const EDITABLE_EXTS = new Set([
  'txt','md','json','csv','js','ts','jsx','tsx','py','java','c','cpp','h',
  'css','scss','html','xml','yaml','yml','sh','sql','env','ini','toml',
  'conf','log','rb','php','go','rs','kt',
]);

export function isEditableFile(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return EDITABLE_EXTS.has(ext);
}
