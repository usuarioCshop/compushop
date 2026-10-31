import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// ─── Paleta Compushop (basada en mockup moderno) ────────────────────────────
// Modo claro: bg #f1f5f9, surface #ffffff, brand #1e3a8a / accent #0ea5e9
// Modo oscuro: bg #070b14, surface #111827, brand #3b82f6 / accent #38bdf8
const brandLight = {
  50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
  500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
};
const brandDark = {
  50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
  500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#172554',
};
const accentLight = {
  50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
  500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e',
};
const accentDark = {
  50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
  500: '#38bdf8', 600: '#0ea5e9', 700: '#0284c7', 800: '#0369a1', 900: '#075985',
};

// Combina las dos rampas en una escala semántica que cambia según el modo.
function modeScale(light, dark) {
  return Object.fromEntries(
    Object.keys(light).map((step) => [step, { default: light[step], _dark: dark[step] }]),
  );
}

function chakraToken(light, dark) {
  return { default: light, _light: light, _dark: dark };
}

const semanticTokens = {
  colors: {
    brand: modeScale(brandLight, brandDark),
    accent: modeScale(accentLight, accentDark),

    // Roles neutros de la paleta
    bg: {
      canvas: { default: '#f1f5f9', _dark: '#070b14' },   // Fondo principal
      surface: { default: '#ffffff', _dark: '#111827' },  // Tarjetas / paneles
      subtle: { default: '#f8fafc', _dark: '#1a2332' },   // Fondo secundario
      elevated: { default: '#ffffff', _dark: '#0c1220' }, // Elevado
      inverted: { default: '#0f172a', _dark: '#0f172a' }, // Bloques oscuros fijos
    },
    fg: {
      default: { default: '#0f172a', _dark: '#f1f5f9' },  // Texto principal
      muted: { default: '#475569', _dark: '#94a3b8' },    // Texto secundario
    },
    border: {
      subtle: { default: '#e2e8f0', _dark: '#1e293b' },
      strong: { default: '#cbd5e1', _dark: '#334155' },
    },

    // Tokens internos de Chakra
    'chakra-body-bg': chakraToken('#f1f5f9', '#070b14'),
    'chakra-body-text': chakraToken('#0f172a', '#f1f5f9'),
    'chakra-subtle-bg': chakraToken('#f8fafc', '#1a2332'),
    'chakra-subtle-text': chakraToken('#475569', '#94a3b8'),
    'chakra-border-color': chakraToken('#e2e8f0', '#1e293b'),
    'chakra-placeholder-color': chakraToken('#64748b', '#94a3b8'),
  },
};

const fonts = {
  heading: `'Inter', system-ui, -apple-system, sans-serif`,
  body: `'Inter', system-ui, -apple-system, sans-serif`,
};

const radii = {
  none: '0',
  sm: '0.375rem',
  md: '0.75rem',
  lg: '1.25rem',
  xl: '1.75rem',
  '2xl': '2rem',
  '3xl': '2.5rem',
  full: '9999px',
};

const styles = {
  global: {
    body: {
      bg: 'bg.canvas',
      color: 'fg.default',
    },
  },
};

const components = {
  Button: {
    defaultProps: { colorScheme: 'brand' },
    baseStyle: {
      fontWeight: '600',
      borderRadius: 'full',
    },
    variants: {
      solid: (props) => ({
        bg: `${props.colorScheme}.500`,
        color: 'white',
        _hover: {
          bg: `${props.colorScheme}.600`,
          transform: 'translateY(-1px)',
          shadow: 'md',
          _disabled: { bg: `${props.colorScheme}.500` },
        },
        _active: { bg: `${props.colorScheme}.700` },
      }),
      // Outline normal (formularios, modo claro/oscuro)
      outline: (props) => ({
        borderWidth: '2px',
        borderColor: `${props.colorScheme}.500`,
        color: `${props.colorScheme}.500`,
        bg: 'transparent',
        _hover: {
          // En modo oscuro conviene un tinte translúcido antes que un fondo casi blanco.
          bg: props.colorMode === 'dark' ? 'whiteAlpha.200' : `${props.colorScheme}.50`,
        },
      }),
      // Outline sobre fondos oscuros (hero)
      outlineLight: {
        borderWidth: '2px',
        borderColor: 'white',
        color: 'white',
        bg: 'transparent',
        _hover: { bg: 'whiteAlpha.200' },
      },
      ghost: {
        _hover: { bg: 'blackAlpha.50' },
        _dark: { _hover: { bg: 'whiteAlpha.100' } },
      },
    },
  },
  Input: {
    defaultProps: { focusBorderColor: 'brand.500' },
    variants: {
      outline: {
        field: {
          borderRadius: 'lg',
          bg: 'bg.surface',
          borderColor: 'border.strong',
          _hover: { borderColor: 'border.strong' },
          _focus: {
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
          },
        },
      },
    },
  },
  Textarea: {
    defaultProps: { focusBorderColor: 'brand.500' },
  },
  Select: {
    defaultProps: { focusBorderColor: 'brand.500' },
  },
  FormLabel: {
    baseStyle: {
      color: 'fg.default',
      fontWeight: '600',
      fontSize: 'sm',
    },
  },
  Link: {
    baseStyle: { _hover: { textDecoration: 'none' } },
  },
  Menu: {
    baseStyle: {
      list: { bg: 'bg.surface', borderColor: 'border.subtle' },
      item: {
        bg: 'bg.surface',
        _hover: { bg: 'bg.subtle' },
        _focus: { bg: 'bg.subtle' },
      },
    },
  },
  Drawer: {
    baseStyle: {
      dialog: { bg: 'bg.surface' },
    },
  },
  Modal: {
    baseStyle: {
      dialog: { bg: 'bg.surface' },
    },
  },
  Table: {
    baseStyle: {
      table: { borderColor: 'border.subtle' },
    },
  },
  Divider: {
    baseStyle: { borderColor: 'border.subtle' },
  },
};

export default extendTheme({
  config,
  semanticTokens,
  fonts,
  radii,
  styles,
  components,
});
