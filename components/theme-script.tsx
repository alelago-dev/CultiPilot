/**
 * Aplica el tema guardado (localStorage "pc-theme") antes del primer pintado,
 * para que no parpadee al cargar la pagina. No sigue prefers-color-scheme: el
 * usuario lo cambia a mano desde el header.
 *
 * El oscuro ("Invernadero nocturno") es el tema por defecto: si nunca se
 * guardo una preferencia, o la preferencia guardada no es "light", se aplica
 * oscuro. Quien ya habia elegido claro a mano sigue viendo claro.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("pc-theme");if(t!=="light"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
