/**
 * Aplica el tema guardado (localStorage "pc-theme") antes del primer pintado,
 * para que el modo oscuro opcional no parpadee en claro al cargar la pagina.
 * No sigue prefers-color-scheme: el usuario lo activa a mano desde el header.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("pc-theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
