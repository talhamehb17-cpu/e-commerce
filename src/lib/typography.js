/** Font stacks intentionally use local/system fonts only; no third-party font requests. */
export const FONT_OPTIONS = [
  ['Inter','Inter / system sans'],['Poppins','Poppins / system sans'],['Montserrat','Montserrat / system sans'],['Roboto','Roboto / system sans'],['Lato','Lato / system sans'],['Open Sans','Open Sans / system sans'],['Nunito','Nunito / system sans'],['Manrope','Manrope / system sans'],['DM Sans','DM Sans / system sans'],['Outfit','Outfit / system sans'],['Plus Jakarta Sans','Plus Jakarta Sans / system sans'],['Playfair Display','Playfair Display / Georgia'],['Merriweather','Merriweather / Georgia'],['Lora','Lora / Georgia'],['Cormorant Garamond','Cormorant Garamond / Georgia'],
];
const SERIF = new Set(['Playfair Display','Merriweather','Lora','Cormorant Garamond']);
export function fontStack(name = 'Inter') {
  if (name === 'Inter') return "'InterVar', Inter, ui-sans-serif, system-ui, sans-serif";
  if (name === 'Cormorant Garamond') return "'Cormorant', 'Cormorant Garamond', Georgia, serif";
  if (SERIF.has(name)) return `'${name}', Georgia, 'Times New Roman', serif`;
  return `'${name}', ui-sans-serif, system-ui, sans-serif`;
}
export function validFont(name) { return FONT_OPTIONS.some(([value]) => value === name); }
export const DEFAULT_FONTS = { heading: 'Cormorant Garamond', body: 'Inter' };
