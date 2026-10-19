import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// ─── Paleta Compushop ────────────────────────────────────────────────────────
// Modo claro → marca #001BE6 (Azul Compushop)  / acción #FF6B00 (Naranja Eléctrico)
// Modo oscuro → marca #3B82F6 (Azul Neón)      / acción #FF8A00 (Naranja Neón)
// Las rampas 50..900 se derivan del color base para que los componentes de
// Chakra (que consumen .500/.600/.50/.200...) funcionen en ambos modos.
const brandLight = {
  50: '#F1F2FE', 100: '#D8DDFD', 200: '#AFB9FD', 300: '#7081FF', 400: '#334BFF',
  500: '#001BE6', 600: '#0016B8', 700: '#00108A', 800: '#000B61', 900: '#000739',
};
const brandDark = {
  50: '#F1F6FE', 100: '#D8E6FD', 200: '#B1CDFB', 300: '#76A8F9', 400: '#3C83F6',
  500: '#3B82F6', 600: '#0F66F4', 700: '#0953CC', 800: '#0843A5', 900: '#06337E',
};
const accentLight = {
  50: '#FEF6F1', 100: '#FDE8D8', 200: '#FDD0AF', 300: '#FFAC70', 400: '#FF8933',
  500: '#FF6B00', 600: '#D15800', 700: '#A34400', 800: '#7A3300', 900: '#522200',
};
const accentDark = {
  50: '#FEF8F1', 100: '#FDECD8', 200: '#FDD9AF', 300: '#FFBD70', 400: '#FFA133',
  500: '#FF8A00', 600: '#D17100', 700: '#A35800', 800: '#7A4200', 900: '#522C00',
};

// Combina las dos rampas en una escala semántica que cambia según el modo.
function modeScale(light, dark) {
  return Object.fromEntries(
    Object.keys(light).map((step) => [step, { default: light[step], _dark: dark[step] }]),
  );
}

// Chakra ya declara sus tokens internos (chakra-body-bg, chakra-subtle-bg, ...)
// usando las claves `_light`/`_dark`. Si los pisamos solo con `default`, ese valor
// cae en `:root` y la regla `[data-theme="light"]` del tema base lo gana en modo
// claro (bug real, verificado en el CSS emitido). Hay que usar las MISMAS claves.
function chakraToken(light, dark) {
  return { default: light, _light: light, _dark: dark };
}

const semanticTokens = {
  colors: {
    brand: modeScale(brandLight, brandDark),
    accent: modeScale(accentLight, accentDark),

    // Roles neutros de la paleta
    bg: {
      canvas: { default: '#F8FAFC', _dark: '#0B0F19' },   // Fondo principal
      surface: { default: '#FFFFFF', _dark: '#1E293B' },  // Tarjetas / paneles
      subtle: { default: '#E2E8F0', _dark: '#1E293B' },   // Fondo secundario
      inverted: { default: '#0F172A', _dark: '#1E293B' }, // Bloques oscuros fijos
    },
    fg: {
      default: { default: '#0F172A', _dark: '#E2E8F0' },  // Texto principal
      muted: { default: '#475569', _dark: '#94A3B8' },    // Texto secundario
    },
    border: {
      subtle: { default: '#E2E8F0', _dark: '#334155' },
      strong: { default: '#CBD5E1', _dark: '#475569' },
    },

    // Tokens internos de Chakra: al pisarlos, la paleta se propaga a TODOS los
    // componentes (Menu, Drawer, Table, Modal, Input, etc.) sin tocar cada uno.
    'chakra-body-bg': chakraToken('#F8FAFC', '#0B0F19'),
    'chakra-body-text': chakraToken('#0F172A', '#E2E8F0'),
    'chakra-subtle-bg': chakraToken('#E2E8F0', '#1E293B'),
    'chakra-subtle-text': chakraToken('#475569', '#94A3B8'),
    'chakra-border-color': chakraToken('#E2E8F0', '#334155'),
    'chakra-placeholder-color': chakraToken('#64748B', '#94A3B8'),
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
