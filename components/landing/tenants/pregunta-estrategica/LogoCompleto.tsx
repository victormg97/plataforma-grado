'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface LogoCompletoProps {
  className?: string;
}

/**
 * Logo completo de "Pregunta Estratégica" con degradado radial nativo SVG.
 * Theme-aware: en modo oscuro se aplica un filtro para oscurecer manteniendo los tonos.
 */
export function LogoCompleto({ className }: LogoCompletoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- hydration guard
  }, []);

  const isDark = mounted && (resolvedTheme === 'dark' || resolvedTheme === 'graduado');

  // En dark mode: oscurecemos solo el emblema; las letras se aclaran
  const svgStyle: React.CSSProperties = {};

  // Color de los textos y balanza: en dark se aclaran para contrastar con el fondo oscuro
  const textFill = isDark ? '#F5E8EC' : '#5a0910';
  const lineFill = isDark ? '#E8C4CE' : '#730a13';
  // Filtro solo para el emblema circular (no para texto)
  const emblemaFilter = isDark ? 'brightness(0.65) saturate(1.1)' : 'none';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 1080.75 1364.999942"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Pregunta Estratégica"
      className={className}
      style={svgStyle}
  >
    {/* CSS dinámico para dark mode */}
    <style>{`
      .pe-emblema { filter: ${emblemaFilter}; }
      .pe-text path { fill: ${textFill} !important; }
      .pe-text rect { fill: ${textFill} !important; }
      .pe-line { stroke: ${lineFill} !important; }
      .pe-line-fill { fill: ${lineFill} !important; }
    `}</style>
    <defs>
      <g />
      <clipPath id="929ce3541a">
        <path
          d="M 0 0.15625 L 1080.5 0.15625 L 1080.5 1350 L 0 1350 Z M 0 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="3a3f0e5b51">
        <path
          d="M 45.050781 0.15625 L 1035.890625 0.15625 L 1035.890625 990.996094 L 45.050781 990.996094 Z M 45.050781 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="c7352d2c10">
        <path
          d="M 540.46875 0.15625 C 266.859375 0.15625 45.050781 221.964844 45.050781 495.574219 C 45.050781 769.1875 266.859375 990.996094 540.46875 990.996094 C 814.082031 990.996094 1035.890625 769.1875 1035.890625 495.574219 C 1035.890625 221.964844 814.082031 0.15625 540.46875 0.15625 Z M 540.46875 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="e24a14ada6">
        <path
          d="M 0.0507812 0.15625 L 990.890625 0.15625 L 990.890625 990.996094 L 0.0507812 990.996094 Z M 0.0507812 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="792fa82236">
        <path
          d="M 495.46875 0.15625 C 221.859375 0.15625 0.0507812 221.964844 0.0507812 495.574219 C 0.0507812 769.1875 221.859375 990.996094 495.46875 990.996094 C 769.082031 990.996094 990.890625 769.1875 990.890625 495.574219 C 990.890625 221.964844 769.082031 0.15625 495.46875 0.15625 Z M 495.46875 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <radialGradient
        gradientTransform="matrix(1, 0, 0, 1, 0.052195, 0.157791)"
        gradientUnits="userSpaceOnUse"
        r={1401.255797}
        cx={0}
        id="ff7aa5e056"
        cy={0}
        fx={0}
        fy={0}
      >
        <stop
          stopOpacity={1}
          stopColor="rgb(71.975708%, 45.654297%, 50.297546%)"
          offset={0}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.412109%, 45.985413%, 50.492859%)"
          offset={0.00390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.846985%, 46.316528%, 50.689697%)"
          offset={0.0078125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.28186%, 46.646118%, 50.88501%)"
          offset={0.0117188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.716736%, 46.977234%, 51.081848%)"
          offset={0.015625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.151611%, 47.30835%, 51.277161%)"
          offset={0.0195312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.586487%, 47.639465%, 51.473999%)"
          offset={0.0234375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.022888%, 47.970581%, 51.669312%)"
          offset={0.0273438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.457764%, 48.301697%, 51.86615%)"
          offset={0.03125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.892639%, 48.632812%, 52.061462%)"
          offset={0.0351562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.327515%, 48.963928%, 52.258301%)"
          offset={0.0390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.76239%, 49.295044%, 52.453613%)"
          offset={0.0429688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.198792%, 49.624634%, 52.650452%)"
          offset={0.046875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.633667%, 49.95575%, 52.845764%)"
          offset={0.0507812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.068542%, 50.286865%, 53.042603%)"
          offset={0.0546875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.503418%, 50.617981%, 53.237915%)"
          offset={0.0585938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.938293%, 50.949097%, 53.434753%)"
          offset={0.0625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.373169%, 51.280212%, 53.630066%)"
          offset={0.0664062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.80957%, 51.611328%, 53.826904%)"
          offset={0.0703125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.244446%, 51.942444%, 54.022217%)"
          offset={0.0742188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.679321%, 52.272034%, 54.219055%)"
          offset={0.078125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.114197%, 52.603149%, 54.414368%)"
          offset={0.0820312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.549072%, 52.934265%, 54.611206%)"
          offset={0.0859375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.985474%, 53.265381%, 54.806519%)"
          offset={0.0898438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.420349%, 53.596497%, 55.003357%)"
          offset={0.09375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.855225%, 53.927612%, 55.198669%)"
          offset={0.0976562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.2901%, 54.258728%, 55.395508%)"
          offset={0.101562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.724976%, 54.589844%, 55.59082%)"
          offset={0.105469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.159851%, 54.920959%, 55.787659%)"
          offset={0.109375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.596252%, 55.250549%, 55.982971%)"
          offset={0.113281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.031128%, 55.581665%, 56.17981%)"
          offset={0.117188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.466003%, 55.912781%, 56.375122%)"
          offset={0.121094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.900879%, 56.243896%, 56.57196%)"
          offset={0.125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.335754%, 56.575012%, 56.767273%)"
          offset={0.128906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.772156%, 56.906128%, 56.964111%)"
          offset={0.132812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.207031%, 57.237244%, 57.159424%)"
          offset={0.136719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 57.568359%, 57.356262%)"
          offset={0.140625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.076782%, 57.899475%, 57.553101%)"
          offset={0.144531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.511658%, 58.229065%, 57.748413%)"
          offset={0.148438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.946533%, 58.560181%, 57.945251%)"
          offset={0.152344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.382935%, 58.891296%, 58.140564%)"
          offset={0.15625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.81781%, 59.222412%, 58.337402%)"
          offset={0.160156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.252686%, 59.553528%, 58.532715%)"
          offset={0.164062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.687561%, 59.884644%, 58.729553%)"
          offset={0.167969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.122437%, 60.215759%, 58.924866%)"
          offset={0.171875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.558838%, 60.546875%, 59.121704%)"
          offset={0.175781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.993713%, 60.876465%, 59.317017%)"
          offset={0.179688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.428589%, 61.207581%, 59.513855%)"
          offset={0.183594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.863464%, 61.538696%, 59.709167%)"
          offset={0.1875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.29834%, 61.869812%, 59.906006%)"
          offset={0.191406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.734741%, 62.200928%, 60.101318%)"
          offset={0.195312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.169617%, 62.532043%, 60.298157%)"
          offset={0.199219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.604492%, 62.863159%, 60.493469%)"
          offset={0.203125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.039368%, 63.194275%, 60.690308%)"
          offset={0.207031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.474243%, 63.525391%, 60.88562%)"
          offset={0.210938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.909119%, 63.85498%, 61.082458%)"
          offset={0.214844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.34552%, 64.186096%, 61.277771%)"
          offset={0.21875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.780396%, 64.517212%, 61.474609%)"
          offset={0.222656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.215271%, 64.848328%, 61.669922%)"
          offset={0.226562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.650146%, 65.179443%, 61.86676%)"
          offset={0.230469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.085022%, 65.510559%, 62.062073%)"
          offset={0.234375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.521423%, 65.841675%, 62.258911%)"
          offset={0.238281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.956299%, 66.172791%, 62.454224%)"
          offset={0.242188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(99.391174%, 66.50238%, 62.651062%)"
          offset={0.246094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(99.391174%, 66.50238%, 62.651062%)"
          offset={0.25}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.956299%, 66.172791%, 62.454224%)"
          offset={0.253906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.521423%, 65.841675%, 62.258911%)"
          offset={0.257812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.085022%, 65.510559%, 62.062073%)"
          offset={0.261719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.650146%, 65.179443%, 61.86676%)"
          offset={0.265625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.215271%, 64.848328%, 61.669922%)"
          offset={0.269531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.780396%, 64.517212%, 61.474609%)"
          offset={0.273438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.34552%, 64.186096%, 61.277771%)"
          offset={0.277344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.909119%, 63.85498%, 61.082458%)"
          offset={0.28125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.474243%, 63.525391%, 60.88562%)"
          offset={0.285156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.039368%, 63.194275%, 60.690308%)"
          offset={0.289062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.604492%, 62.863159%, 60.493469%)"
          offset={0.292969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.169617%, 62.532043%, 60.298157%)"
          offset={0.296875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.734741%, 62.200928%, 60.101318%)"
          offset={0.300781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.29834%, 61.869812%, 59.906006%)"
          offset={0.304688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.863464%, 61.538696%, 59.709167%)"
          offset={0.308594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.428589%, 61.207581%, 59.513855%)"
          offset={0.3125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.993713%, 60.876465%, 59.317017%)"
          offset={0.316406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.558838%, 60.546875%, 59.121704%)"
          offset={0.320312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.122437%, 60.215759%, 58.924866%)"
          offset={0.324219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.687561%, 59.884644%, 58.729553%)"
          offset={0.328125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.252686%, 59.553528%, 58.532715%)"
          offset={0.332031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.81781%, 59.222412%, 58.337402%)"
          offset={0.335938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.382935%, 58.891296%, 58.140564%)"
          offset={0.339844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.946533%, 58.560181%, 57.945251%)"
          offset={0.34375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.511658%, 58.229065%, 57.748413%)"
          offset={0.347656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.076782%, 57.899475%, 57.553101%)"
          offset={0.351562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 57.568359%, 57.356262%)"
          offset={0.355469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.207031%, 57.237244%, 57.159424%)"
          offset={0.359375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.772156%, 56.906128%, 56.964111%)"
          offset={0.363281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.335754%, 56.575012%, 56.767273%)"
          offset={0.367188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.900879%, 56.243896%, 56.57196%)"
          offset={0.371094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.466003%, 55.912781%, 56.375122%)"
          offset={0.375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.031128%, 55.581665%, 56.17981%)"
          offset={0.378906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.596252%, 55.250549%, 55.982971%)"
          offset={0.382812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.159851%, 54.920959%, 55.787659%)"
          offset={0.386719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.724976%, 54.589844%, 55.59082%)"
          offset={0.390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.2901%, 54.258728%, 55.395508%)"
          offset={0.394531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.855225%, 53.927612%, 55.198669%)"
          offset={0.398438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.420349%, 53.596497%, 55.003357%)"
          offset={0.402344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.985474%, 53.265381%, 54.806519%)"
          offset={0.40625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.549072%, 52.934265%, 54.611206%)"
          offset={0.410156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.114197%, 52.603149%, 54.414368%)"
          offset={0.414062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.679321%, 52.272034%, 54.219055%)"
          offset={0.417969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.244446%, 51.942444%, 54.022217%)"
          offset={0.421875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.80957%, 51.611328%, 53.826904%)"
          offset={0.425781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.373169%, 51.280212%, 53.630066%)"
          offset={0.429688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.938293%, 50.949097%, 53.434753%)"
          offset={0.433594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.503418%, 50.617981%, 53.237915%)"
          offset={0.4375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.068542%, 50.286865%, 53.042603%)"
          offset={0.441406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.633667%, 49.95575%, 52.845764%)"
          offset={0.445312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.198792%, 49.624634%, 52.650452%)"
          offset={0.449219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.76239%, 49.295044%, 52.453613%)"
          offset={0.453125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.327515%, 48.963928%, 52.258301%)"
          offset={0.457031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.892639%, 48.632812%, 52.061462%)"
          offset={0.460938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.457764%, 48.301697%, 51.86615%)"
          offset={0.464844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.022888%, 47.970581%, 51.669312%)"
          offset={0.46875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.586487%, 47.639465%, 51.473999%)"
          offset={0.472656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.151611%, 47.30835%, 51.277161%)"
          offset={0.476562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.716736%, 46.977234%, 51.081848%)"
          offset={0.480469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.28186%, 46.646118%, 50.88501%)"
          offset={0.484375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.846985%, 46.316528%, 50.689697%)"
          offset={0.488281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.412109%, 45.985413%, 50.492859%)"
          offset={0.492188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.975708%, 45.654297%, 50.297546%)"
          offset={0.496094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.954346%, 45.845032%, 50.422668%)"
          offset={0.5}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.346497%, 46.554565%, 50.869751%)"
          offset={0.503906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.738647%, 47.265625%, 51.316833%)"
          offset={0.507812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.130798%, 47.976685%, 51.763916%)"
          offset={0.511719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.522949%, 48.687744%, 52.210999%)"
          offset={0.515625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.9151%, 49.398804%, 52.658081%)"
          offset={0.519531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.307251%, 50.109863%, 53.105164%)"
          offset={0.523438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.699402%, 50.819397%, 53.552246%)"
          offset={0.527344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.091553%, 51.530457%, 53.999329%)"
          offset={0.53125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.483704%, 52.241516%, 54.446411%)"
          offset={0.535156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.875854%, 52.952576%, 54.893494%)"
          offset={0.539062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.268005%, 53.663635%, 55.340576%)"
          offset={0.542969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.660156%, 54.373169%, 55.787659%)"
          offset={0.546875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.052307%, 55.084229%, 56.236267%)"
          offset={0.550781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.444458%, 55.795288%, 56.68335%)"
          offset={0.554688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.838135%, 56.506348%, 57.130432%)"
          offset={0.558594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.230286%, 57.217407%, 57.577515%)"
          offset={0.5625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.622437%, 57.928467%, 58.024597%)"
          offset={0.566406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.014587%, 58.638%, 58.47168%)"
          offset={0.570312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.406738%, 59.34906%, 58.918762%)"
          offset={0.574219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.798889%, 60.06012%, 59.365845%)"
          offset={0.578125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.19104%, 60.771179%, 59.812927%)"
          offset={0.582031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.583191%, 61.482239%, 60.26001%)"
          offset={0.585938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.975342%, 62.191772%, 60.707092%)"
          offset={0.589844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.367493%, 62.902832%, 61.154175%)"
          offset={0.59375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.759644%, 63.613892%, 61.601257%)"
          offset={0.597656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.151794%, 64.324951%, 62.04834%)"
          offset={0.601562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.543945%, 65.036011%, 62.495422%)"
          offset={0.605469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.936096%, 65.74707%, 62.944031%)"
          offset={0.609375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.328247%, 66.456604%, 63.391113%)"
          offset={0.613281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.720398%, 67.167664%, 63.838196%)"
          offset={0.617188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.112549%, 67.878723%, 64.285278%)"
          offset={0.621094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.5047%, 68.589783%, 64.732361%)"
          offset={0.625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.896851%, 69.300842%, 65.179443%)"
          offset={0.628906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.289001%, 70.010376%, 65.626526%)"
          offset={0.632812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.681152%, 70.721436%, 66.073608%)"
          offset={0.636719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.073303%, 71.432495%, 66.520691%)"
          offset={0.640625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.465454%, 72.143555%, 66.967773%)"
          offset={0.644531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.857605%, 72.854614%, 67.414856%)"
          offset={0.648438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.249756%, 73.565674%, 67.861938%)"
          offset={0.652344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 74.275208%, 68.309021%)"
          offset={0.65625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.034058%, 74.986267%, 68.756104%)"
          offset={0.660156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.426208%, 75.697327%, 69.204712%)"
          offset={0.664062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.818359%, 76.408386%, 69.651794%)"
          offset={0.667969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.21051%, 77.119446%, 70.098877%)"
          offset={0.671875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.602661%, 77.828979%, 70.545959%)"
          offset={0.675781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.994812%, 78.540039%, 70.993042%)"
          offset={0.679688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.386963%, 79.251099%, 71.440125%)"
          offset={0.683594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.779114%, 79.962158%, 71.887207%)"
          offset={0.6875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.171265%, 80.673218%, 72.33429%)"
          offset={0.691406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.563416%, 81.384277%, 72.781372%)"
          offset={0.695312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.955566%, 82.093811%, 73.228455%)"
          offset={0.699219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.347717%, 82.804871%, 73.675537%)"
          offset={0.703125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.739868%, 83.51593%, 74.12262%)"
          offset={0.707031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.132019%, 84.22699%, 74.569702%)"
          offset={0.710938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.52417%, 84.938049%, 75.016785%)"
          offset={0.714844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.917847%, 85.647583%, 75.463867%)"
          offset={0.71875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.309998%, 86.358643%, 75.912476%)"
          offset={0.722656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.702148%, 87.069702%, 76.359558%)"
          offset={0.726562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.094299%, 87.780762%, 76.806641%)"
          offset={0.730469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.48645%, 88.491821%, 77.253723%)"
          offset={0.734375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.878601%, 89.202881%, 77.700806%)"
          offset={0.738281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.270752%, 89.912415%, 78.147888%)"
          offset={0.742188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.662903%, 90.623474%, 78.594971%)"
          offset={0.746094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.662903%, 90.623474%, 78.594971%)"
          offset={0.75}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.270752%, 89.912415%, 78.147888%)"
          offset={0.753906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.878601%, 89.202881%, 77.700806%)"
          offset={0.757812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.48645%, 88.491821%, 77.253723%)"
          offset={0.761719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.094299%, 87.780762%, 76.806641%)"
          offset={0.765625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.702148%, 87.069702%, 76.359558%)"
          offset={0.769531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.309998%, 86.358643%, 75.912476%)"
          offset={0.773438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.917847%, 85.647583%, 75.463867%)"
          offset={0.777344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.52417%, 84.938049%, 75.016785%)"
          offset={0.78125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.132019%, 84.22699%, 74.569702%)"
          offset={0.785156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.739868%, 83.51593%, 74.12262%)"
          offset={0.789062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.347717%, 82.804871%, 73.675537%)"
          offset={0.792969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.955566%, 82.093811%, 73.228455%)"
          offset={0.796875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.563416%, 81.384277%, 72.781372%)"
          offset={0.800781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.171265%, 80.673218%, 72.33429%)"
          offset={0.804688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.779114%, 79.962158%, 71.887207%)"
          offset={0.808594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.386963%, 79.251099%, 71.440125%)"
          offset={0.8125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.994812%, 78.540039%, 70.993042%)"
          offset={0.816406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.602661%, 77.828979%, 70.545959%)"
          offset={0.820312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.21051%, 77.119446%, 70.098877%)"
          offset={0.824219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.818359%, 76.408386%, 69.651794%)"
          offset={0.828125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.426208%, 75.697327%, 69.204712%)"
          offset={0.832031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.034058%, 74.986267%, 68.756104%)"
          offset={0.835938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 74.275208%, 68.309021%)"
          offset={0.839844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.249756%, 73.565674%, 67.861938%)"
          offset={0.84375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.857605%, 72.854614%, 67.414856%)"
          offset={0.847656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.465454%, 72.143555%, 66.967773%)"
          offset={0.851562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.073303%, 71.432495%, 66.520691%)"
          offset={0.855469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.681152%, 70.721436%, 66.073608%)"
          offset={0.859375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.289001%, 70.010376%, 65.626526%)"
          offset={0.863281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.896851%, 69.300842%, 65.179443%)"
          offset={0.867188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.5047%, 68.589783%, 64.732361%)"
          offset={0.871094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.112549%, 67.878723%, 64.285278%)"
          offset={0.875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.720398%, 67.167664%, 63.838196%)"
          offset={0.878906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.328247%, 66.456604%, 63.391113%)"
          offset={0.882812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.936096%, 65.74707%, 62.944031%)"
          offset={0.886719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.543945%, 65.036011%, 62.495422%)"
          offset={0.890625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.151794%, 64.324951%, 62.04834%)"
          offset={0.894531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.759644%, 63.613892%, 61.601257%)"
          offset={0.898438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.367493%, 62.902832%, 61.154175%)"
          offset={0.902344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.975342%, 62.191772%, 60.707092%)"
          offset={0.90625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.583191%, 61.482239%, 60.26001%)"
          offset={0.910156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.19104%, 60.771179%, 59.812927%)"
          offset={0.914062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.798889%, 60.06012%, 59.365845%)"
          offset={0.917969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.406738%, 59.34906%, 58.918762%)"
          offset={0.921875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.014587%, 58.638%, 58.47168%)"
          offset={0.925781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.622437%, 57.928467%, 58.024597%)"
          offset={0.929688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.230286%, 57.217407%, 57.577515%)"
          offset={0.933594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.838135%, 56.506348%, 57.130432%)"
          offset={0.9375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.444458%, 55.795288%, 56.68335%)"
          offset={0.941406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.052307%, 55.084229%, 56.236267%)"
          offset={0.945312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.660156%, 54.373169%, 55.787659%)"
          offset={0.949219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.268005%, 53.663635%, 55.340576%)"
          offset={0.953125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.875854%, 52.952576%, 54.893494%)"
          offset={0.957031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.483704%, 52.241516%, 54.446411%)"
          offset={0.960938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.091553%, 51.530457%, 53.999329%)"
          offset={0.964844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.699402%, 50.819397%, 53.552246%)"
          offset={0.96875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.307251%, 50.109863%, 53.105164%)"
          offset={0.972656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.9151%, 49.398804%, 52.658081%)"
          offset={0.976562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.522949%, 48.687744%, 52.210999%)"
          offset={0.980469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.130798%, 47.976685%, 51.763916%)"
          offset={0.984375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.738647%, 47.265625%, 51.316833%)"
          offset={0.988281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.346497%, 46.554565%, 50.869751%)"
          offset={0.992188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.954346%, 45.845032%, 50.422668%)"
          offset={0.996094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.759033%, 45.489502%, 50.19989%)"
          offset={1}
        />
      </radialGradient>
      <clipPath id="dccf44ed00">
        <rect x={0} width={991} y={0} height={991} />
      </clipPath>
      <clipPath id="cd8ab4e0a4">
        <path
          d="M 45.050781 0.15625 L 1035.761719 0.15625 L 1035.761719 990.867188 L 45.050781 990.867188 Z M 45.050781 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="c7f2c126fc">
        <path
          d="M 540.46875 0.15625 C 266.859375 0.15625 45.050781 221.964844 45.050781 495.574219 C 45.050781 769.1875 266.859375 990.992188 540.46875 990.992188 C 814.082031 990.992188 1035.886719 769.1875 1035.886719 495.574219 C 1035.886719 221.964844 814.082031 0.15625 540.46875 0.15625 Z M 540.46875 0.15625 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="163b89050d">
        <path
          d="M 99.121094 54.226562 L 981.820312 54.226562 L 981.820312 936.925781 L 99.121094 936.925781 Z M 99.121094 54.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="83f2b34bb8">
        <path
          d="M 540.46875 54.226562 C 296.71875 54.226562 99.121094 251.824219 99.121094 495.574219 C 99.121094 739.328125 296.71875 936.925781 540.46875 936.925781 C 784.222656 936.925781 981.820312 739.328125 981.820312 495.574219 C 981.820312 251.824219 784.222656 54.226562 540.46875 54.226562 Z M 540.46875 54.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="3a9a5c6376">
        <path
          d="M 0.121094 0.226562 L 882.820312 0.226562 L 882.820312 882.925781 L 0.121094 882.925781 Z M 0.121094 0.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="7f19357e32">
        <path
          d="M 441.46875 0.226562 C 197.71875 0.226562 0.121094 197.824219 0.121094 441.574219 C 0.121094 685.328125 197.71875 882.925781 441.46875 882.925781 C 685.222656 882.925781 882.820312 685.328125 882.820312 441.574219 C 882.820312 197.824219 685.222656 0.226562 441.46875 0.226562 Z M 441.46875 0.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <radialGradient
        gradientTransform="matrix(1, 0, 0, 1, 0.119582, 0.225171)"
        gradientUnits="userSpaceOnUse"
        r={1248.330089}
        cx={0}
        id="1e20dcf6bc"
        cy={0}
        fx={0}
        fy={0}
      >
        <stop
          stopOpacity={1}
          stopColor="rgb(71.975708%, 45.654297%, 50.297546%)"
          offset={0}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.412109%, 45.985413%, 50.492859%)"
          offset={0.00390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.846985%, 46.316528%, 50.689697%)"
          offset={0.0078125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.28186%, 46.646118%, 50.88501%)"
          offset={0.0117188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.716736%, 46.977234%, 51.081848%)"
          offset={0.015625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.151611%, 47.30835%, 51.277161%)"
          offset={0.0195312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.586487%, 47.639465%, 51.473999%)"
          offset={0.0234375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.022888%, 47.970581%, 51.669312%)"
          offset={0.0273438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.457764%, 48.301697%, 51.86615%)"
          offset={0.03125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.892639%, 48.632812%, 52.061462%)"
          offset={0.0351562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.327515%, 48.963928%, 52.258301%)"
          offset={0.0390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.76239%, 49.295044%, 52.453613%)"
          offset={0.0429688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.198792%, 49.624634%, 52.650452%)"
          offset={0.046875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.633667%, 49.95575%, 52.845764%)"
          offset={0.0507812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.068542%, 50.286865%, 53.042603%)"
          offset={0.0546875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.503418%, 50.617981%, 53.237915%)"
          offset={0.0585938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.938293%, 50.949097%, 53.434753%)"
          offset={0.0625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.373169%, 51.280212%, 53.630066%)"
          offset={0.0664062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.80957%, 51.611328%, 53.826904%)"
          offset={0.0703125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.244446%, 51.942444%, 54.022217%)"
          offset={0.0742188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.679321%, 52.272034%, 54.219055%)"
          offset={0.078125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.114197%, 52.603149%, 54.414368%)"
          offset={0.0820312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.549072%, 52.934265%, 54.611206%)"
          offset={0.0859375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.985474%, 53.265381%, 54.806519%)"
          offset={0.0898438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.420349%, 53.596497%, 55.003357%)"
          offset={0.09375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.855225%, 53.927612%, 55.198669%)"
          offset={0.0976562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.2901%, 54.258728%, 55.395508%)"
          offset={0.101562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.724976%, 54.589844%, 55.59082%)"
          offset={0.105469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.159851%, 54.920959%, 55.787659%)"
          offset={0.109375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.596252%, 55.250549%, 55.982971%)"
          offset={0.113281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.031128%, 55.581665%, 56.17981%)"
          offset={0.117188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.466003%, 55.912781%, 56.375122%)"
          offset={0.121094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.900879%, 56.243896%, 56.57196%)"
          offset={0.125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.335754%, 56.575012%, 56.767273%)"
          offset={0.128906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.772156%, 56.906128%, 56.964111%)"
          offset={0.132812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.207031%, 57.237244%, 57.159424%)"
          offset={0.136719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 57.568359%, 57.356262%)"
          offset={0.140625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.076782%, 57.899475%, 57.553101%)"
          offset={0.144531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.511658%, 58.229065%, 57.748413%)"
          offset={0.148438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.946533%, 58.560181%, 57.945251%)"
          offset={0.152344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.382935%, 58.891296%, 58.140564%)"
          offset={0.15625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.81781%, 59.222412%, 58.337402%)"
          offset={0.160156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.252686%, 59.553528%, 58.532715%)"
          offset={0.164062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.687561%, 59.884644%, 58.729553%)"
          offset={0.167969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.122437%, 60.215759%, 58.924866%)"
          offset={0.171875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.558838%, 60.546875%, 59.121704%)"
          offset={0.175781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.993713%, 60.876465%, 59.317017%)"
          offset={0.179688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.428589%, 61.207581%, 59.513855%)"
          offset={0.183594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.863464%, 61.538696%, 59.709167%)"
          offset={0.1875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.29834%, 61.869812%, 59.906006%)"
          offset={0.191406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.734741%, 62.200928%, 60.101318%)"
          offset={0.195312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.169617%, 62.532043%, 60.298157%)"
          offset={0.199219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.604492%, 62.863159%, 60.493469%)"
          offset={0.203125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.039368%, 63.194275%, 60.690308%)"
          offset={0.207031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.474243%, 63.525391%, 60.88562%)"
          offset={0.210938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.909119%, 63.85498%, 61.082458%)"
          offset={0.214844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.34552%, 64.186096%, 61.277771%)"
          offset={0.21875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.780396%, 64.517212%, 61.474609%)"
          offset={0.222656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.215271%, 64.848328%, 61.669922%)"
          offset={0.226562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.650146%, 65.179443%, 61.86676%)"
          offset={0.230469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.085022%, 65.510559%, 62.062073%)"
          offset={0.234375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.521423%, 65.841675%, 62.258911%)"
          offset={0.238281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.956299%, 66.172791%, 62.454224%)"
          offset={0.242188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(99.391174%, 66.50238%, 62.651062%)"
          offset={0.246094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(99.391174%, 66.50238%, 62.651062%)"
          offset={0.25}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.956299%, 66.172791%, 62.454224%)"
          offset={0.253906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.521423%, 65.841675%, 62.258911%)"
          offset={0.257812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(98.085022%, 65.510559%, 62.062073%)"
          offset={0.261719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.650146%, 65.179443%, 61.86676%)"
          offset={0.265625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(97.215271%, 64.848328%, 61.669922%)"
          offset={0.269531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.780396%, 64.517212%, 61.474609%)"
          offset={0.273438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.34552%, 64.186096%, 61.277771%)"
          offset={0.277344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.909119%, 63.85498%, 61.082458%)"
          offset={0.28125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.474243%, 63.525391%, 60.88562%)"
          offset={0.285156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.039368%, 63.194275%, 60.690308%)"
          offset={0.289062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.604492%, 62.863159%, 60.493469%)"
          offset={0.292969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.169617%, 62.532043%, 60.298157%)"
          offset={0.296875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.734741%, 62.200928%, 60.101318%)"
          offset={0.300781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.29834%, 61.869812%, 59.906006%)"
          offset={0.304688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.863464%, 61.538696%, 59.709167%)"
          offset={0.308594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.428589%, 61.207581%, 59.513855%)"
          offset={0.3125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.993713%, 60.876465%, 59.317017%)"
          offset={0.316406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.558838%, 60.546875%, 59.121704%)"
          offset={0.320312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.122437%, 60.215759%, 58.924866%)"
          offset={0.324219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.687561%, 59.884644%, 58.729553%)"
          offset={0.328125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.252686%, 59.553528%, 58.532715%)"
          offset={0.332031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.81781%, 59.222412%, 58.337402%)"
          offset={0.335938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.382935%, 58.891296%, 58.140564%)"
          offset={0.339844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.946533%, 58.560181%, 57.945251%)"
          offset={0.34375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.511658%, 58.229065%, 57.748413%)"
          offset={0.347656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.076782%, 57.899475%, 57.553101%)"
          offset={0.351562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 57.568359%, 57.356262%)"
          offset={0.355469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.207031%, 57.237244%, 57.159424%)"
          offset={0.359375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.772156%, 56.906128%, 56.964111%)"
          offset={0.363281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.335754%, 56.575012%, 56.767273%)"
          offset={0.367188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.900879%, 56.243896%, 56.57196%)"
          offset={0.371094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.466003%, 55.912781%, 56.375122%)"
          offset={0.375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.031128%, 55.581665%, 56.17981%)"
          offset={0.378906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.596252%, 55.250549%, 55.982971%)"
          offset={0.382812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.159851%, 54.920959%, 55.787659%)"
          offset={0.386719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.724976%, 54.589844%, 55.59082%)"
          offset={0.390625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.2901%, 54.258728%, 55.395508%)"
          offset={0.394531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.855225%, 53.927612%, 55.198669%)"
          offset={0.398438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.420349%, 53.596497%, 55.003357%)"
          offset={0.402344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.985474%, 53.265381%, 54.806519%)"
          offset={0.40625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.549072%, 52.934265%, 54.611206%)"
          offset={0.410156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.114197%, 52.603149%, 54.414368%)"
          offset={0.414062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.679321%, 52.272034%, 54.219055%)"
          offset={0.417969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.244446%, 51.942444%, 54.022217%)"
          offset={0.421875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.80957%, 51.611328%, 53.826904%)"
          offset={0.425781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.373169%, 51.280212%, 53.630066%)"
          offset={0.429688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.938293%, 50.949097%, 53.434753%)"
          offset={0.433594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.503418%, 50.617981%, 53.237915%)"
          offset={0.4375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.068542%, 50.286865%, 53.042603%)"
          offset={0.441406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.633667%, 49.95575%, 52.845764%)"
          offset={0.445312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.198792%, 49.624634%, 52.650452%)"
          offset={0.449219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.76239%, 49.295044%, 52.453613%)"
          offset={0.453125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.327515%, 48.963928%, 52.258301%)"
          offset={0.457031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.892639%, 48.632812%, 52.061462%)"
          offset={0.460938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.457764%, 48.301697%, 51.86615%)"
          offset={0.464844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.022888%, 47.970581%, 51.669312%)"
          offset={0.46875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.586487%, 47.639465%, 51.473999%)"
          offset={0.472656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.151611%, 47.30835%, 51.277161%)"
          offset={0.476562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.716736%, 46.977234%, 51.081848%)"
          offset={0.480469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.28186%, 46.646118%, 50.88501%)"
          offset={0.484375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.846985%, 46.316528%, 50.689697%)"
          offset={0.488281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.412109%, 45.985413%, 50.492859%)"
          offset={0.492188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.975708%, 45.654297%, 50.297546%)"
          offset={0.496094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.954346%, 45.845032%, 50.422668%)"
          offset={0.5}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.346497%, 46.554565%, 50.869751%)"
          offset={0.503906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.738647%, 47.265625%, 51.316833%)"
          offset={0.507812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.130798%, 47.976685%, 51.763916%)"
          offset={0.511719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.522949%, 48.687744%, 52.210999%)"
          offset={0.515625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.9151%, 49.398804%, 52.658081%)"
          offset={0.519531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.307251%, 50.109863%, 53.105164%)"
          offset={0.523438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.699402%, 50.819397%, 53.552246%)"
          offset={0.527344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.091553%, 51.530457%, 53.999329%)"
          offset={0.53125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.483704%, 52.241516%, 54.446411%)"
          offset={0.535156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.875854%, 52.952576%, 54.893494%)"
          offset={0.539062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.268005%, 53.663635%, 55.340576%)"
          offset={0.542969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.660156%, 54.373169%, 55.787659%)"
          offset={0.546875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.052307%, 55.084229%, 56.236267%)"
          offset={0.550781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.444458%, 55.795288%, 56.68335%)"
          offset={0.554688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.838135%, 56.506348%, 57.130432%)"
          offset={0.558594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.230286%, 57.217407%, 57.577515%)"
          offset={0.5625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.622437%, 57.928467%, 58.024597%)"
          offset={0.566406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.014587%, 58.638%, 58.47168%)"
          offset={0.570312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.406738%, 59.34906%, 58.918762%)"
          offset={0.574219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.798889%, 60.06012%, 59.365845%)"
          offset={0.578125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.19104%, 60.771179%, 59.812927%)"
          offset={0.582031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.583191%, 61.482239%, 60.26001%)"
          offset={0.585938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.975342%, 62.191772%, 60.707092%)"
          offset={0.589844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.367493%, 62.902832%, 61.154175%)"
          offset={0.59375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.759644%, 63.613892%, 61.601257%)"
          offset={0.597656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.151794%, 64.324951%, 62.04834%)"
          offset={0.601562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.543945%, 65.036011%, 62.495422%)"
          offset={0.605469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.936096%, 65.74707%, 62.944031%)"
          offset={0.609375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.328247%, 66.456604%, 63.391113%)"
          offset={0.613281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.720398%, 67.167664%, 63.838196%)"
          offset={0.617188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.112549%, 67.878723%, 64.285278%)"
          offset={0.621094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.5047%, 68.589783%, 64.732361%)"
          offset={0.625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.896851%, 69.300842%, 65.179443%)"
          offset={0.628906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.289001%, 70.010376%, 65.626526%)"
          offset={0.632812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.681152%, 70.721436%, 66.073608%)"
          offset={0.636719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.073303%, 71.432495%, 66.520691%)"
          offset={0.640625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.465454%, 72.143555%, 66.967773%)"
          offset={0.644531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.857605%, 72.854614%, 67.414856%)"
          offset={0.648438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.249756%, 73.565674%, 67.861938%)"
          offset={0.652344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 74.275208%, 68.309021%)"
          offset={0.65625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.034058%, 74.986267%, 68.756104%)"
          offset={0.660156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.426208%, 75.697327%, 69.204712%)"
          offset={0.664062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.818359%, 76.408386%, 69.651794%)"
          offset={0.667969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.21051%, 77.119446%, 70.098877%)"
          offset={0.671875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.602661%, 77.828979%, 70.545959%)"
          offset={0.675781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.994812%, 78.540039%, 70.993042%)"
          offset={0.679688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.386963%, 79.251099%, 71.440125%)"
          offset={0.683594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.779114%, 79.962158%, 71.887207%)"
          offset={0.6875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.171265%, 80.673218%, 72.33429%)"
          offset={0.691406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.563416%, 81.384277%, 72.781372%)"
          offset={0.695312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.955566%, 82.093811%, 73.228455%)"
          offset={0.699219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.347717%, 82.804871%, 73.675537%)"
          offset={0.703125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.739868%, 83.51593%, 74.12262%)"
          offset={0.707031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.132019%, 84.22699%, 74.569702%)"
          offset={0.710938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.52417%, 84.938049%, 75.016785%)"
          offset={0.714844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.917847%, 85.647583%, 75.463867%)"
          offset={0.71875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.309998%, 86.358643%, 75.912476%)"
          offset={0.722656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.702148%, 87.069702%, 76.359558%)"
          offset={0.726562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.094299%, 87.780762%, 76.806641%)"
          offset={0.730469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.48645%, 88.491821%, 77.253723%)"
          offset={0.734375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.878601%, 89.202881%, 77.700806%)"
          offset={0.738281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.270752%, 89.912415%, 78.147888%)"
          offset={0.742188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.662903%, 90.623474%, 78.594971%)"
          offset={0.746094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.662903%, 90.623474%, 78.594971%)"
          offset={0.75}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(96.270752%, 89.912415%, 78.147888%)"
          offset={0.753906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.878601%, 89.202881%, 77.700806%)"
          offset={0.757812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.48645%, 88.491821%, 77.253723%)"
          offset={0.761719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(95.094299%, 87.780762%, 76.806641%)"
          offset={0.765625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.702148%, 87.069702%, 76.359558%)"
          offset={0.769531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(94.309998%, 86.358643%, 75.912476%)"
          offset={0.773438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.917847%, 85.647583%, 75.463867%)"
          offset={0.777344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.52417%, 84.938049%, 75.016785%)"
          offset={0.78125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(93.132019%, 84.22699%, 74.569702%)"
          offset={0.785156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.739868%, 83.51593%, 74.12262%)"
          offset={0.789062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(92.347717%, 82.804871%, 73.675537%)"
          offset={0.792969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.955566%, 82.093811%, 73.228455%)"
          offset={0.796875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.563416%, 81.384277%, 72.781372%)"
          offset={0.800781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(91.171265%, 80.673218%, 72.33429%)"
          offset={0.804688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.779114%, 79.962158%, 71.887207%)"
          offset={0.808594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(90.386963%, 79.251099%, 71.440125%)"
          offset={0.8125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.994812%, 78.540039%, 70.993042%)"
          offset={0.816406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.602661%, 77.828979%, 70.545959%)"
          offset={0.820312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(89.21051%, 77.119446%, 70.098877%)"
          offset={0.824219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.818359%, 76.408386%, 69.651794%)"
          offset={0.828125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.426208%, 75.697327%, 69.204712%)"
          offset={0.832031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(88.034058%, 74.986267%, 68.756104%)"
          offset={0.835938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.641907%, 74.275208%, 68.309021%)"
          offset={0.839844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(87.249756%, 73.565674%, 67.861938%)"
          offset={0.84375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.857605%, 72.854614%, 67.414856%)"
          offset={0.847656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.465454%, 72.143555%, 66.967773%)"
          offset={0.851562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(86.073303%, 71.432495%, 66.520691%)"
          offset={0.855469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.681152%, 70.721436%, 66.073608%)"
          offset={0.859375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(85.289001%, 70.010376%, 65.626526%)"
          offset={0.863281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.896851%, 69.300842%, 65.179443%)"
          offset={0.867188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.5047%, 68.589783%, 64.732361%)"
          offset={0.871094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(84.112549%, 67.878723%, 64.285278%)"
          offset={0.875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.720398%, 67.167664%, 63.838196%)"
          offset={0.878906}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(83.328247%, 66.456604%, 63.391113%)"
          offset={0.882812}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.936096%, 65.74707%, 62.944031%)"
          offset={0.886719}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.543945%, 65.036011%, 62.495422%)"
          offset={0.890625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(82.151794%, 64.324951%, 62.04834%)"
          offset={0.894531}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.759644%, 63.613892%, 61.601257%)"
          offset={0.898438}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(81.367493%, 62.902832%, 61.154175%)"
          offset={0.902344}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.975342%, 62.191772%, 60.707092%)"
          offset={0.90625}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.583191%, 61.482239%, 60.26001%)"
          offset={0.910156}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(80.19104%, 60.771179%, 59.812927%)"
          offset={0.914062}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.798889%, 60.06012%, 59.365845%)"
          offset={0.917969}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.406738%, 59.34906%, 58.918762%)"
          offset={0.921875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(79.014587%, 58.638%, 58.47168%)"
          offset={0.925781}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.622437%, 57.928467%, 58.024597%)"
          offset={0.929688}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(78.230286%, 57.217407%, 57.577515%)"
          offset={0.933594}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.838135%, 56.506348%, 57.130432%)"
          offset={0.9375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.444458%, 55.795288%, 56.68335%)"
          offset={0.941406}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(77.052307%, 55.084229%, 56.236267%)"
          offset={0.945312}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.660156%, 54.373169%, 55.787659%)"
          offset={0.949219}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(76.268005%, 53.663635%, 55.340576%)"
          offset={0.953125}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.875854%, 52.952576%, 54.893494%)"
          offset={0.957031}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.483704%, 52.241516%, 54.446411%)"
          offset={0.960938}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(75.091553%, 51.530457%, 53.999329%)"
          offset={0.964844}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.699402%, 50.819397%, 53.552246%)"
          offset={0.96875}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(74.307251%, 50.109863%, 53.105164%)"
          offset={0.972656}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.9151%, 49.398804%, 52.658081%)"
          offset={0.976562}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.522949%, 48.687744%, 52.210999%)"
          offset={0.980469}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(73.130798%, 47.976685%, 51.763916%)"
          offset={0.984375}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.738647%, 47.265625%, 51.316833%)"
          offset={0.988281}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(72.346497%, 46.554565%, 50.869751%)"
          offset={0.992188}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.954346%, 45.845032%, 50.422668%)"
          offset={0.996094}
        />
        <stop
          stopOpacity={1}
          stopColor="rgb(71.759033%, 45.489502%, 50.19989%)"
          offset={1}
        />
      </radialGradient>
      <clipPath id="3156c2172a">
        <rect x={0} width={883} y={0} height={883} />
      </clipPath>
      <clipPath id="1f6db8e328">
        <path
          d="M 99.121094 54.226562 L 981.671875 54.226562 L 981.671875 936.777344 L 99.121094 936.777344 Z M 99.121094 54.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="f1e06124a5">
        <path
          d="M 540.46875 54.226562 C 296.71875 54.226562 99.121094 251.824219 99.121094 495.574219 C 99.121094 739.328125 296.71875 936.925781 540.46875 936.925781 C 784.222656 936.925781 981.820312 739.328125 981.820312 495.574219 C 981.820312 251.824219 784.222656 54.226562 540.46875 54.226562 Z M 540.46875 54.226562 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="ccb185d4b1">
        <rect x={0} width={894} y={0} height={164} />
      </clipPath>
      <clipPath id="66ee6b0e6e">
        <path
          d="M 81 1212 L 1028 1212 L 1028 1349.84375 L 81 1349.84375 Z M 81 1212 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="a25a4a064b">
        <rect x={0} width={947} y={0} height={138} />
      </clipPath>
      <clipPath id="12a46c1608">
        <path
          d="M 1054 1186 L 1080.5 1186 L 1080.5 1213 L 1054 1213 Z M 1054 1186 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="67cbd80896">
        <path
          d="M 240.226562 271 L 840 271 L 840 720.109375 L 240.226562 720.109375 Z M 240.226562 271 "
          clipRule="nonzero"
        />
      </clipPath>
      <clipPath id="2d5cedc2f5">
        <rect x={0} width={1081} y={0} height={1350} />
      </clipPath>
    </defs>
    <g clipPath="url(#929ce3541a)" className="pe-emblema">
      <g transform="matrix(1, 0, 0, 1, -0, 0.000000000000039579)">
        <g clipPath="url(#2d5cedc2f5)">
          <g clipPath="url(#3a3f0e5b51)">
            <g clipPath="url(#c7352d2c10)">
              <g transform="matrix(1, 0, 0, 1, 45, 0.000000000000039579)">
                <g clipPath="url(#dccf44ed00)">
                  <g clipPath="url(#e24a14ada6)">
                    <g clipPath="url(#792fa82236)">
                      <path
                        fill="url(#ff7aa5e056)"
                        d="M 0.0507812 0.15625 L 0.0507812 990.996094 L 990.890625 990.996094 L 990.890625 0.15625 Z M 0.0507812 0.15625 "
                        fillRule="nonzero"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g clipPath="url(#cd8ab4e0a4)">
            <g clipPath="url(#c7f2c126fc)">
              <path
                strokeLinecap="butt"
                transform="matrix(0.721041, 0, 0, 0.721041, 45.052195, 0.157791)"
                fill="none"
                strokeLinejoin="miter"
                d="M 687.085433 -0.00213714 C 307.620892 -0.00213714 -0.00196072 307.620715 -0.00196072 687.085257 C -0.00196072 1066.555216 307.620892 1374.172651 687.085433 1374.172651 C 1066.555392 1374.172651 1374.172827 1066.555216 1374.172827 687.085257 C 1374.172827 307.620715 1066.555392 -0.00213714 687.085433 -0.00213714 Z M 687.085433 -0.00213714 "
                stroke="#000000"
                strokeWidth={16.63876}
                strokeOpacity={1}
                strokeMiterlimit={4}
              />
            </g>
          </g>
          <g clipPath="url(#163b89050d)">
            <g clipPath="url(#83f2b34bb8)">
              <g transform="matrix(1, 0, 0, 1, 99, 54)">
                <g clipPath="url(#3156c2172a)">
                  <g clipPath="url(#3a9a5c6376)">
                    <g clipPath="url(#7f19357e32)">
                      <path
                        fill="url(#1e20dcf6bc)"
                        d="M 0.121094 0.226562 L 0.121094 882.925781 L 882.820312 882.925781 L 882.820312 0.226562 Z M 0.121094 0.226562 "
                        fillRule="nonzero"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g clipPath="url(#1f6db8e328)">
            <g clipPath="url(#f1e06124a5)">
              <path
                strokeLinecap="butt"
                transform="matrix(0.721041, 0, 0, 0.721041, 99.119575, 54.225171)"
                fill="none"
                strokeLinejoin="miter"
                d="M 612.100173 0.0019304 C 274.047163 0.0019304 0.00210682 274.046987 0.00210682 612.099997 C 0.00210682 950.158424 274.047163 1224.20348 612.100173 1224.20348 C 950.153183 1224.20348 1224.203657 950.158424 1224.203657 612.099997 C 1224.203657 274.046987 950.153183 0.0019304 612.100173 0.0019304 Z M 612.100173 0.0019304 "
                stroke="#000000"
                strokeWidth={16.63876}
                strokeOpacity={1}
                strokeMiterlimit={4}
              />
            </g>
          </g>
          <g transform="matrix(1, 0, 0, 1, 121, 1024)" className="pe-text">
            <g clipPath="url(#ccb185d4b1)">
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(0.386744, 118.308622)">
                  <g>
                    <path d="M 76.390625 -60.921875 C 76.390625 -57.179688 75.660156 -53.648438 74.203125 -50.328125 C 71.441406 -43.910156 66.320312 -39.519531 58.84375 -37.15625 C 56.65625 -36.425781 54.628906 -36.0625 52.765625 -36.0625 C 46.992188 -36.0625 41.832031 -37.566406 37.28125 -40.578125 L 37.28125 -41.796875 C 43.375 -41.628906 48.289062 -43.617188 52.03125 -47.765625 C 55.28125 -51.335938 56.90625 -56.007812 56.90625 -61.78125 C 56.90625 -67.625 55.503906 -72.148438 52.703125 -75.359375 C 49.898438 -78.566406 46.101562 -80.171875 41.3125 -80.171875 L 33.140625 -80.171875 L 33.140625 -8.890625 C 33.140625 -6.785156 33.910156 -4.976562 35.453125 -3.46875 C 36.992188 -1.96875 38.820312 -1.21875 40.9375 -1.21875 L 42.53125 -1.21875 L 42.53125 0 L 5.484375 0 L 5.484375 -1.21875 L 7.0625 -1.21875 C 9.175781 -1.21875 10.984375 -1.96875 12.484375 -3.46875 C 13.992188 -4.976562 14.785156 -6.785156 14.859375 -8.890625 L 14.859375 -77 C 14.859375 -79.03125 14.085938 -80.71875 12.546875 -82.0625 C 11.003906 -83.40625 9.175781 -84.078125 7.0625 -84.078125 L 5.484375 -84.078125 L 5.484375 -85.296875 L 46.171875 -85.296875 C 56.085938 -85.296875 63.5625 -83.179688 68.59375 -78.953125 C 73.789062 -74.484375 76.390625 -68.472656 76.390625 -60.921875 Z M 76.390625 -60.921875 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(111.01449, 118.308622)">
                  <g>
                    <path d="M 34.484375 -68.109375 L 30.578125 -68.109375 L 30.578125 -7.671875 C 30.578125 -5.722656 31.25 -4.160156 32.59375 -2.984375 C 33.9375 -1.804688 35.457031 -1.21875 37.15625 -1.21875 L 38.5 -1.21875 L 38.5 0 L 5 0 L 5 -1.21875 L 6.453125 -1.21875 C 8.242188 -1.21875 9.769531 -1.828125 11.03125 -3.046875 C 12.289062 -4.265625 12.921875 -5.765625 12.921875 -7.546875 L 12.921875 -65.546875 C 12.921875 -67.335938 12.289062 -68.84375 11.03125 -70.0625 C 9.769531 -71.28125 8.285156 -71.890625 6.578125 -71.890625 L 5 -71.890625 L 5 -73.109375 L 42.40625 -73.109375 C 49.71875 -73.109375 55.847656 -71.6875 60.796875 -68.84375 C 66.316406 -65.675781 69.078125 -60.4375 69.078125 -53.125 C 69.078125 -48.414062 67.65625 -44.171875 64.8125 -40.390625 C 61.976562 -36.609375 57.757812 -34.3125 52.15625 -33.5 C 54.34375 -32.769531 56.507812 -31.390625 58.65625 -29.359375 C 60.8125 -27.328125 62.539062 -25.257812 63.84375 -23.15625 C 66.445312 -18.519531 69.171875 -14.269531 72.015625 -10.40625 C 74.859375 -6.550781 77.148438 -4.054688 78.890625 -2.921875 C 80.640625 -1.785156 82.773438 -1.21875 85.296875 -1.21875 L 85.296875 0 L 75.0625 0 C 68.3125 0 63.128906 -0.8125 59.515625 -2.4375 C 55.898438 -4.0625 52.671875 -7.148438 49.828125 -11.703125 C 45.441406 -18.679688 42.722656 -24.203125 41.671875 -28.265625 C 40.691406 -30.703125 39.53125 -32.53125 38.1875 -33.75 C 36.851562 -34.96875 35.578125 -35.660156 34.359375 -35.828125 L 34.359375 -36.796875 L 37.40625 -36.796875 C 44.3125 -36.878906 48.535156 -40.941406 50.078125 -48.984375 C 50.398438 -50.203125 50.5625 -51.253906 50.5625 -52.140625 C 50.5625 -53.035156 50.519531 -54.273438 50.4375 -55.859375 C 50.363281 -57.441406 49.859375 -59.226562 48.921875 -61.21875 C 47.984375 -63.21875 46.785156 -64.660156 45.328125 -65.546875 C 42.804688 -67.085938 40.207031 -67.898438 37.53125 -67.984375 C 36.632812 -68.066406 35.617188 -68.109375 34.484375 -68.109375 Z M 34.484375 -68.109375 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(222.373271, 118.308622)">
                  <g>
                    <path d="M 61.53125 0 L 4.140625 0 L 4.140625 -1.21875 L 5.609375 -1.21875 C 7.472656 -1.21875 9.035156 -1.828125 10.296875 -3.046875 C 11.554688 -4.265625 12.226562 -5.765625 12.3125 -7.546875 L 12.3125 -65.546875 C 12.226562 -67.335938 11.554688 -68.84375 10.296875 -70.0625 C 9.035156 -71.28125 7.472656 -71.890625 5.609375 -71.890625 L 4.140625 -71.890625 L 4.140625 -73.109375 L 47.03125 -73.109375 C 49.226562 -73.109375 51.625 -73.3125 54.21875 -73.71875 C 56.820312 -74.125 58.648438 -74.53125 59.703125 -74.9375 L 59.703125 -55.5625 L 58.484375 -55.5625 L 58.484375 -56.65625 C 58.484375 -60.226562 57.507812 -63.03125 55.5625 -65.0625 C 53.613281 -67.09375 50.890625 -68.148438 47.390625 -68.234375 L 29.859375 -68.234375 L 29.859375 -38.625 L 43.734375 -38.625 C 46.503906 -38.707031 48.738281 -39.640625 50.4375 -41.421875 C 52.144531 -43.210938 53 -45.488281 53 -48.25 L 53 -49.109375 L 54.21875 -49.109375 L 54.21875 -23.265625 L 53 -23.265625 L 53 -24.125 C 53 -27.945312 51.578125 -30.707031 48.734375 -32.40625 C 47.273438 -33.300781 45.648438 -33.75 43.859375 -33.75 L 29.859375 -33.75 L 29.859375 -4.875 L 44.46875 -4.875 C 49.507812 -4.957031 53.796875 -6.519531 57.328125 -9.5625 C 60.859375 -12.613281 63.4375 -16.898438 65.0625 -22.421875 L 66.15625 -22.421875 Z M 61.53125 0 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(323.741886, 118.308622)">
                  <g>
                    <path d="M 15.046875 -8.703125 C 7.773438 -15.492188 4.140625 -24.816406 4.140625 -36.671875 C 4.140625 -48.535156 7.773438 -57.835938 15.046875 -64.578125 C 22.316406 -71.316406 32.328125 -74.6875 45.078125 -74.6875 C 50.765625 -74.6875 56.367188 -74.175781 61.890625 -73.15625 C 67.421875 -72.144531 71.890625 -70.785156 75.296875 -69.078125 L 75.296875 -49.71875 L 74.328125 -49.71875 C 70.753906 -63.113281 62.222656 -69.8125 48.734375 -69.8125 C 40.285156 -69.8125 33.847656 -66.867188 29.421875 -60.984375 C 24.992188 -55.097656 22.78125 -46.894531 22.78125 -36.375 C 22.78125 -25.851562 24.789062 -17.707031 28.8125 -11.9375 C 32.832031 -6.175781 38.539062 -3.296875 45.9375 -3.296875 C 50 -3.296875 53.65625 -4.25 56.90625 -6.15625 C 60.15625 -8.0625 62.304688 -10.800781 63.359375 -14.375 L 63.484375 -29 C 63.484375 -30.539062 63.015625 -31.738281 62.078125 -32.59375 C 61.140625 -33.445312 59.820312 -33.875 58.125 -33.875 L 56.40625 -33.875 L 56.40625 -34.84375 L 87.734375 -34.84375 L 87.734375 -33.875 L 86.265625 -33.875 C 82.691406 -33.875 80.90625 -32.25 80.90625 -29 L 80.90625 -12.671875 C 78.0625 -9.015625 73.265625 -5.722656 66.515625 -2.796875 C 59.773438 0.117188 52.382812 1.578125 44.34375 1.578125 C 32.082031 1.503906 22.316406 -1.921875 15.046875 -8.703125 Z M 15.046875 -8.703125 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(443.994473, 118.308622)">
                  <g>
                    <path d="M 83.46875 -71.890625 L 81.75 -71.890625 C 80.207031 -71.890625 78.910156 -71.421875 77.859375 -70.484375 C 76.804688 -69.546875 76.238281 -68.347656 76.15625 -66.890625 L 76.15625 -26.5625 C 76.15625 -17.789062 73.472656 -10.90625 68.109375 -5.90625 C 62.742188 -0.914062 54.757812 1.578125 44.15625 1.578125 C 33.5625 1.578125 25.316406 -0.851562 19.421875 -5.71875 C 13.535156 -10.59375 10.59375 -17.457031 10.59375 -26.3125 L 10.59375 -66.765625 C 10.59375 -68.234375 10.046875 -69.453125 8.953125 -70.421875 C 7.859375 -71.398438 6.539062 -71.890625 5 -71.890625 L 3.296875 -71.890625 L 3.296875 -73.109375 L 35.328125 -73.109375 L 35.328125 -71.890625 L 33.625 -71.890625 C 32.082031 -71.890625 30.78125 -71.398438 29.71875 -70.421875 C 28.664062 -69.453125 28.140625 -68.234375 28.140625 -66.765625 L 28.140625 -27.171875 C 28.140625 -19.703125 29.863281 -13.851562 33.3125 -9.625 C 36.769531 -5.40625 41.625 -3.296875 47.875 -3.296875 C 54.132812 -3.296875 59.070312 -5.285156 62.6875 -9.265625 C 66.300781 -13.242188 68.109375 -18.765625 68.109375 -25.828125 L 68.109375 -66.765625 C 68.023438 -68.304688 67.457031 -69.546875 66.40625 -70.484375 C 65.351562 -71.421875 64.050781 -71.890625 62.5 -71.890625 L 60.921875 -71.890625 L 60.921875 -73.109375 L 83.46875 -73.109375 Z M 83.46875 -71.890625 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(560.348368, 118.308622)">
                  <g>
                    <path d="M 58.234375 -73.109375 L 92.484375 -73.109375 L 92.484375 -71.890625 L 90.40625 -71.890625 C 88.539062 -71.890625 86.976562 -71.316406 85.71875 -70.171875 C 84.457031 -69.035156 83.785156 -67.578125 83.703125 -65.796875 L 83.703125 -12.546875 C 83.703125 -7.515625 84.03125 -3.375 84.6875 -0.125 L 84.921875 1.578125 L 83.828125 1.578125 L 27.90625 -47.765625 L 27.90625 -7.4375 C 27.988281 -5.644531 28.65625 -4.160156 29.90625 -2.984375 C 31.164062 -1.804688 32.734375 -1.21875 34.609375 -1.21875 L 36.671875 -1.21875 L 36.671875 0 L 2.5625 0 L 2.5625 -1.21875 L 4.515625 -1.21875 C 6.378906 -1.21875 7.957031 -1.804688 9.25 -2.984375 C 10.550781 -4.160156 11.203125 -5.644531 11.203125 -7.4375 L 11.203125 -61.046875 C 11.203125 -65.921875 10.878906 -69.941406 10.234375 -73.109375 L 9.984375 -74.8125 L 11.09375 -74.6875 L 66.890625 -25.59375 L 66.890625 -65.671875 C 66.890625 -67.460938 66.257812 -68.945312 65 -70.125 C 63.738281 -71.300781 62.175781 -71.890625 60.3125 -71.890625 L 58.234375 -71.890625 Z M 58.234375 -73.109375 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(686.570762, 118.308622)">
                  <g>
                    <path d="M 70.546875 -55.796875 L 70.546875 -56.90625 C 70.546875 -60.394531 69.570312 -63.15625 67.625 -65.1875 C 65.675781 -67.21875 62.953125 -68.273438 59.453125 -68.359375 L 45.328125 -68.359375 L 45.328125 -7.546875 C 45.410156 -5.765625 46.097656 -4.265625 47.390625 -3.046875 C 48.691406 -1.828125 50.238281 -1.21875 52.03125 -1.21875 L 53.375 -1.21875 L 53.375 0 L 19.734375 0 L 19.734375 -1.21875 L 20.953125 -1.21875 C 22.828125 -1.21875 24.410156 -1.828125 25.703125 -3.046875 C 27.003906 -4.265625 27.65625 -5.804688 27.65625 -7.671875 L 27.65625 -68.359375 L 13.640625 -68.359375 C 10.066406 -68.273438 7.304688 -67.21875 5.359375 -65.1875 C 3.410156 -63.15625 2.4375 -60.394531 2.4375 -56.90625 L 2.4375 -55.796875 L 1.21875 -55.796875 L 1.21875 -75.0625 C 2.351562 -74.65625 4.238281 -74.25 6.875 -73.84375 C 9.519531 -73.4375 11.898438 -73.234375 14.015625 -73.234375 L 58.96875 -73.234375 C 62.539062 -73.234375 65.484375 -73.492188 67.796875 -74.015625 C 70.117188 -74.546875 71.441406 -74.894531 71.765625 -75.0625 L 71.765625 -55.796875 Z M 70.546875 -55.796875 " />
                  </g>
                </g>
              </g>
              <g fill="#5a0910" fillOpacity={1}>
                <g transform="translate(783.430817, 118.308622)">
                  <g>
                    <path d="M 81.15625 -1.21875 L 82.125 -1.21875 L 82.125 0 L 46.296875 0 L 46.296875 -1.21875 L 47.28125 -1.21875 C 48.90625 -1.21875 50.082031 -1.703125 50.8125 -2.671875 C 51.539062 -3.648438 51.90625 -4.546875 51.90625 -5.359375 C 51.90625 -6.171875 51.742188 -7.023438 51.421875 -7.921875 L 46.671875 -19.125 L 20.84375 -19.125 L 15.96875 -7.796875 C 15.644531 -6.984375 15.484375 -6.148438 15.484375 -5.296875 C 15.484375 -4.441406 15.867188 -3.546875 16.640625 -2.609375 C 17.410156 -1.679688 18.609375 -1.21875 20.234375 -1.21875 L 21.203125 -1.21875 L 21.203125 0 L -3.171875 0 L -3.171875 -1.21875 L -2.1875 -1.21875 C -0.476562 -1.21875 1.222656 -1.742188 2.921875 -2.796875 C 4.628906 -3.859375 6.007812 -5.441406 7.0625 -7.546875 L 32.296875 -61.65625 C 35.867188 -69.695312 37.734375 -74.648438 37.890625 -76.515625 L 39 -76.515625 L 71.640625 -8.046875 C 72.703125 -5.691406 74.101562 -3.960938 75.84375 -2.859375 C 77.59375 -1.765625 79.363281 -1.21875 81.15625 -1.21875 Z M 22.90625 -23.875 L 44.59375 -23.875 L 33.875 -49.34375 Z M 22.90625 -23.875 " />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g clipPath="url(#66ee6b0e6e)">
            <g transform="matrix(1, 0, 0, 1, 81, 1212)" className="pe-text">
              <g clipPath="url(#a25a4a064b)">
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(0.608848, 98.843874)">
                    <g>
                      <path d="M 7.5 -1.03125 C 9.269531 -1.03125 10.785156 -1.660156 12.046875 -2.921875 C 13.316406 -4.191406 13.988281 -5.71875 14.0625 -7.5 L 14.0625 -64.96875 C 13.851562 -66.613281 13.132812 -68 11.90625 -69.125 C 10.675781 -70.257812 9.207031 -70.828125 7.5 -70.828125 L 6.265625 -70.828125 L 6.15625 -71.84375 L 36.234375 -71.84375 C 38.347656 -71.84375 40.65625 -72.046875 43.15625 -72.453125 C 45.65625 -72.867188 47.421875 -73.285156 48.453125 -73.703125 L 48.453125 -60.765625 L 47.421875 -60.765625 L 47.421875 -62.609375 C 47.421875 -64.253906 46.851562 -65.65625 45.71875 -66.8125 C 44.59375 -67.976562 43.242188 -68.597656 41.671875 -68.671875 L 20.734375 -68.671875 L 20.734375 -36.953125 L 38.078125 -36.953125 C 39.441406 -37.015625 40.601562 -37.523438 41.5625 -38.484375 C 42.519531 -39.441406 43 -40.640625 43 -42.078125 L 43 -43.515625 L 44.03125 -43.515625 L 44.03125 -27.296875 L 43 -27.296875 L 43 -28.84375 C 43 -30.207031 42.535156 -31.367188 41.609375 -32.328125 C 40.691406 -33.285156 39.550781 -33.800781 38.1875 -33.875 L 20.734375 -33.875 L 20.734375 -3.1875 L 35.40625 -3.1875 C 40.46875 -3.1875 44.332031 -4.3125 47 -6.5625 C 49.675781 -8.820312 51.90625 -12.175781 53.6875 -16.625 L 54.703125 -16.625 L 48.75 0 L 6.15625 0 L 6.15625 -1.03125 Z M 7.5 -1.03125 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(86.213951, 98.843874)">
                    <g>
                      <path d="M 5.953125 -3.390625 C 5.742188 -4.210938 5.640625 -5.890625 5.640625 -8.421875 C 5.640625 -10.953125 6.085938 -13.515625 6.984375 -16.109375 L 8.21875 -16.109375 C 8.144531 -15.492188 8.109375 -14.878906 8.109375 -14.265625 C 8.109375 -10.566406 9.320312 -7.535156 11.75 -5.171875 C 14.175781 -2.816406 17.546875 -1.640625 21.859375 -1.640625 C 26.378906 -1.640625 29.90625 -2.679688 32.4375 -4.765625 C 34.96875 -6.859375 36.234375 -9.5625 36.234375 -12.875 C 36.234375 -16.195312 35 -18.953125 32.53125 -21.140625 L 12.015625 -36.953125 C 8.722656 -39.753906 7.078125 -43.515625 7.078125 -48.234375 C 7.078125 -50.910156 7.8125 -53.375 9.28125 -55.625 C 10.757812 -57.882812 12.816406 -59.679688 15.453125 -61.015625 C 18.085938 -62.347656 21.179688 -63.015625 24.734375 -63.015625 C 28.296875 -63.015625 31.441406 -62.707031 34.171875 -62.09375 L 37.5625 -62.09375 L 37.765625 -50.90625 L 36.640625 -50.90625 C 36.640625 -53.78125 35.644531 -56.003906 33.65625 -57.578125 C 31.675781 -59.148438 28.835938 -59.9375 25.140625 -59.9375 C 21.453125 -59.9375 18.410156 -58.992188 16.015625 -57.109375 C 13.617188 -55.234375 12.421875 -52.804688 12.421875 -49.828125 C 12.421875 -46.847656 13.753906 -44.265625 16.421875 -42.078125 L 37.15625 -26.078125 C 40.300781 -23.472656 41.875 -19.84375 41.875 -15.1875 C 41.875 -10.539062 40.113281 -6.609375 36.59375 -3.390625 C 33.070312 -0.171875 28.773438 1.4375 23.703125 1.4375 C 20.359375 1.4375 17.007812 1.023438 13.65625 0.203125 C 10.300781 -0.617188 7.734375 -1.816406 5.953125 -3.390625 Z M 5.953125 -3.390625 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(160.015073, 98.843874)">
                    <g>
                      <path d="M 33.046875 -58.609375 L 33.046875 -6.46875 C 33.117188 -4.34375 34.144531 -2.769531 36.125 -1.75 C 37.019531 -1.269531 38.015625 -1.03125 39.109375 -1.03125 L 40.234375 -1.03125 L 40.234375 0 L 19.09375 0 L 19.09375 -1.03125 L 20.328125 -1.03125 C 21.960938 -1.03125 23.363281 -1.578125 24.53125 -2.671875 C 25.695312 -3.765625 26.3125 -5.0625 26.375 -6.5625 L 26.375 -58.609375 L 7.796875 -58.609375 C 6.222656 -58.609375 4.972656 -58.09375 4.046875 -57.0625 C 3.128906 -56.039062 2.671875 -54.8125 2.671875 -53.375 L 2.671875 -51.734375 L 1.546875 -51.734375 L 1.546875 -63.328125 C 2.910156 -62.785156 4.835938 -62.375 7.328125 -62.09375 C 9.828125 -61.820312 11.695312 -61.6875 12.9375 -61.6875 L 46.390625 -61.6875 C 51.316406 -61.6875 55.148438 -62.234375 57.890625 -63.328125 L 57.890625 -51.734375 L 56.765625 -51.734375 L 56.765625 -53.375 C 56.765625 -54.8125 56.285156 -56.039062 55.328125 -57.0625 C 54.367188 -58.09375 53.132812 -58.609375 51.625 -58.609375 Z M 33.046875 -58.609375 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(245.72282, 98.843874)">
                    <g>
                      <path d="M 24.84375 -58.40625 L 19.40625 -58.40625 L 19.40625 -6.5625 C 19.46875 -4.445312 20.421875 -2.84375 22.265625 -1.75 C 23.160156 -1.269531 24.15625 -1.03125 25.25 -1.03125 L 26.578125 -1.03125 L 26.6875 0 L 5.640625 0 L 5.640625 -1.03125 L 7.078125 -1.03125 C 8.648438 -1.03125 10 -1.554688 11.125 -2.609375 C 12.257812 -3.671875 12.828125 -4.957031 12.828125 -6.46875 L 12.828125 -55.21875 C 12.828125 -56.726562 12.257812 -57.992188 11.125 -59.015625 C 10 -60.046875 8.648438 -60.5625 7.078125 -60.5625 L 5.640625 -60.5625 L 5.640625 -61.578125 L 31.40625 -61.578125 C 37.84375 -61.578125 42.925781 -60.101562 46.65625 -57.15625 C 50.382812 -54.21875 52.25 -50.351562 52.25 -45.5625 C 52.25 -40.78125 50.742188 -36.78125 47.734375 -33.5625 C 44.722656 -30.34375 40.890625 -28.492188 36.234375 -28.015625 C 38.421875 -27.054688 41.054688 -24.390625 44.140625 -20.015625 C 44.066406 -20.015625 45.242188 -18.507812 47.671875 -15.5 C 50.109375 -12.488281 52.0625 -10.144531 53.53125 -8.46875 C 55 -6.789062 56.210938 -5.507812 57.171875 -4.625 C 59.703125 -2.226562 62.609375 -1.03125 65.890625 -1.03125 L 65.890625 0 L 62.71875 0 C 57.3125 0 53.066406 -1.0625 49.984375 -3.1875 C 47.660156 -4.757812 45.539062 -6.707031 43.625 -9.03125 C 43.207031 -9.582031 41.476562 -11.992188 38.4375 -16.265625 C 35.394531 -20.546875 33.769531 -22.820312 33.5625 -23.09375 C 29.863281 -27.675781 26.410156 -29.96875 23.203125 -29.96875 L 23.203125 -31 C 31.203125 -31 36.023438 -31.410156 37.671875 -32.234375 C 39.929688 -33.390625 41.46875 -34.617188 42.28125 -35.921875 C 44 -38.660156 44.859375 -41.671875 44.859375 -44.953125 C 44.859375 -49.128906 43.625 -52.34375 41.15625 -54.59375 C 38.695312 -56.851562 35.378906 -58.085938 31.203125 -58.296875 C 29.359375 -58.367188 27.238281 -58.40625 24.84375 -58.40625 Z M 24.84375 -58.40625 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(336.460087, 98.843874)">
                    <g>
                      <path d="M 67.75 -1.03125 L 68.5625 -1.03125 L 68.5625 0 L 47.515625 0 L 47.515625 -1.03125 L 48.34375 -1.03125 C 49.644531 -1.03125 50.632812 -1.472656 51.3125 -2.359375 C 52 -3.242188 52.34375 -4.082031 52.34375 -4.875 C 52.34375 -5.664062 52.207031 -6.4375 51.9375 -7.1875 L 46.296875 -20.84375 L 20.328125 -20.84375 L 14.671875 -7.5 C 14.335938 -6.601562 14.171875 -5.757812 14.171875 -4.96875 C 14.171875 -4.1875 14.507812 -3.332031 15.1875 -2.40625 C 15.875 -1.488281 16.898438 -1.03125 18.265625 -1.03125 L 19.09375 -1.03125 L 19.09375 0 L -0.515625 0 L -0.515625 -1.03125 L 0.3125 -1.03125 C 1.75 -1.03125 3.203125 -1.523438 4.671875 -2.515625 C 6.140625 -3.503906 7.351562 -4.992188 8.3125 -6.984375 C 23.300781 -39.003906 31.101562 -55.769531 31.71875 -57.28125 C 32.875 -60.144531 33.488281 -62.054688 33.5625 -63.015625 L 34.484375 -63.015625 L 59.84375 -6.984375 C 61.820312 -3.015625 64.457031 -1.03125 67.75 -1.03125 Z M 21.65625 -23.921875 L 45.0625 -23.921875 L 33.5625 -52.03125 Z M 21.65625 -23.921875 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(423.707335, 98.843874)">
                    <g>
                      <path d="M 33.046875 -58.609375 L 33.046875 -6.46875 C 33.117188 -4.34375 34.144531 -2.769531 36.125 -1.75 C 37.019531 -1.269531 38.015625 -1.03125 39.109375 -1.03125 L 40.234375 -1.03125 L 40.234375 0 L 19.09375 0 L 19.09375 -1.03125 L 20.328125 -1.03125 C 21.960938 -1.03125 23.363281 -1.578125 24.53125 -2.671875 C 25.695312 -3.765625 26.3125 -5.0625 26.375 -6.5625 L 26.375 -58.609375 L 7.796875 -58.609375 C 6.222656 -58.609375 4.972656 -58.09375 4.046875 -57.0625 C 3.128906 -56.039062 2.671875 -54.8125 2.671875 -53.375 L 2.671875 -51.734375 L 1.546875 -51.734375 L 1.546875 -63.328125 C 2.910156 -62.785156 4.835938 -62.375 7.328125 -62.09375 C 9.828125 -61.820312 11.695312 -61.6875 12.9375 -61.6875 L 46.390625 -61.6875 C 51.316406 -61.6875 55.148438 -62.234375 57.890625 -63.328125 L 57.890625 -51.734375 L 56.765625 -51.734375 L 56.765625 -53.375 C 56.765625 -54.8125 56.285156 -56.039062 55.328125 -57.0625 C 54.367188 -58.09375 53.132812 -58.609375 51.625 -58.609375 Z M 33.046875 -58.609375 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(509.415057, 98.843874)">
                    <g>
                      <path d="M 30.484375 -68.15625 L 29.765625 -68.875 C 34.960938 -74.476562 39.304688 -78.957031 42.796875 -82.3125 C 44.648438 -80.46875 46.054688 -78.65625 47.015625 -76.875 C 42.566406 -74.34375 37.054688 -71.4375 30.484375 -68.15625 Z M 7.078125 -1.03125 C 8.722656 -1.03125 10.109375 -1.554688 11.234375 -2.609375 C 12.367188 -3.671875 12.96875 -4.957031 13.03125 -6.46875 L 13.03125 -55.21875 C 13.03125 -56.726562 12.445312 -57.992188 11.28125 -59.015625 C 10.125 -60.046875 8.722656 -60.5625 7.078125 -60.5625 L 5.640625 -60.5625 L 5.640625 -61.578125 L 35.609375 -61.578125 C 37.597656 -61.578125 39.769531 -61.75 42.125 -62.09375 C 44.488281 -62.4375 46.148438 -62.816406 47.109375 -63.234375 L 47.109375 -51.625 L 45.984375 -51.625 L 45.984375 -53.171875 C 45.984375 -55.222656 45.160156 -56.726562 43.515625 -57.6875 C 42.765625 -58.164062 41.875 -58.40625 40.84375 -58.40625 L 19.5 -58.40625 L 19.5 -32.328125 L 37.046875 -32.328125 C 38.898438 -32.398438 40.164062 -33.117188 40.84375 -34.484375 C 41.125 -35.171875 41.265625 -35.890625 41.265625 -36.640625 L 41.265625 -37.984375 L 42.390625 -37.984375 L 42.390625 -23.609375 L 41.265625 -23.609375 L 41.265625 -24.9375 C 41.265625 -26.101562 40.921875 -27.097656 40.234375 -27.921875 C 39.546875 -28.742188 38.585938 -29.1875 37.359375 -29.25 L 19.5 -29.25 L 19.5 -3.1875 L 35.609375 -3.1875 C 38.765625 -3.1875 41.414062 -3.734375 43.5625 -4.828125 C 45.71875 -5.921875 47.359375 -7.21875 48.484375 -8.71875 C 49.617188 -10.226562 50.769531 -12.210938 51.9375 -14.671875 L 52.96875 -14.671875 L 47.3125 0 L 5.640625 0 L 5.640625 -1.03125 Z M 7.078125 -1.03125 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(591.838255, 98.843874)">
                    <g>
                      <path d="M 38.796875 1.4375 C 28.597656 1.363281 20.4375 -1.5625 14.3125 -7.34375 C 8.1875 -13.125 5.125 -20.957031 5.125 -30.84375 C 5.125 -40.726562 8.1875 -48.5625 14.3125 -54.34375 C 20.4375 -60.125 28.335938 -63.015625 38.015625 -63.015625 C 47.703125 -63.015625 55.9375 -60.960938 62.71875 -56.859375 L 64.96875 -42.28125 L 64.046875 -42.28125 C 62.609375 -48.3125 59.816406 -52.757812 55.671875 -55.625 C 51.535156 -58.5 45.6875 -59.9375 38.125 -59.9375 C 30.570312 -59.9375 24.414062 -57.316406 19.65625 -52.078125 C 14.894531 -46.847656 12.515625 -39.75 12.515625 -30.78125 C 12.515625 -21.820312 14.910156 -14.722656 19.703125 -9.484375 C 24.492188 -4.253906 31.113281 -1.640625 39.5625 -1.640625 C 48.019531 -1.640625 55.289062 -4.617188 61.375 -10.578125 L 61.484375 -24.21875 C 61.546875 -25.457031 61.148438 -26.429688 60.296875 -27.140625 C 59.441406 -27.859375 58.265625 -28.21875 56.765625 -28.21875 L 55.328125 -28.21875 L 55.328125 -29.25 L 74.109375 -29.25 L 74.109375 -28.21875 L 72.671875 -28.21875 C 69.585938 -28.21875 68.046875 -26.851562 68.046875 -24.125 L 68.046875 -11.796875 C 65.171875 -8.242188 61.21875 -5.148438 56.1875 -2.515625 C 51.164062 0.117188 45.367188 1.4375 38.796875 1.4375 Z M 38.796875 1.4375 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(692.839822, 98.843874)">
                    <g>
                      <path d="M 7.078125 -1.03125 C 8.929688 -1.03125 10.539062 -1.578125 11.90625 -2.671875 C 13.269531 -3.765625 13.953125 -5.0625 13.953125 -6.5625 L 13.953125 -55.015625 C 13.953125 -56.523438 13.269531 -57.828125 11.90625 -58.921875 C 10.539062 -60.015625 8.898438 -60.5625 6.984375 -60.5625 L 5.640625 -60.5625 L 5.640625 -61.578125 L 28.84375 -61.578125 L 28.84375 -60.5625 L 27.5 -60.5625 C 25.65625 -60.5625 24.066406 -60.046875 22.734375 -59.015625 C 21.398438 -57.992188 20.664062 -56.726562 20.53125 -55.21875 L 20.53125 -6.46875 C 20.59375 -4.957031 21.304688 -3.671875 22.671875 -2.609375 C 24.046875 -1.554688 25.65625 -1.03125 27.5 -1.03125 L 28.84375 -1.03125 L 28.9375 0 L 5.640625 0 L 5.640625 -1.03125 Z M 7.078125 -1.03125 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(752.168191, 98.843874)">
                    <g>
                      <path d="M 39 1.4375 C 28.53125 1.363281 20.265625 -1.539062 14.203125 -7.28125 C 8.148438 -13.03125 5.125 -20.882812 5.125 -30.84375 C 5.125 -40.800781 8.148438 -48.648438 14.203125 -54.390625 C 20.265625 -60.140625 28.53125 -63.015625 39 -63.015625 C 43.238281 -63.015625 47.515625 -62.46875 51.828125 -61.375 C 56.140625 -60.28125 59.867188 -58.773438 63.015625 -56.859375 L 65.28125 -42.28125 L 64.359375 -42.28125 C 61.410156 -54.050781 52.925781 -59.9375 38.90625 -59.9375 C 30.757812 -59.9375 24.320312 -57.335938 19.59375 -52.140625 C 14.875 -46.941406 12.515625 -39.828125 12.515625 -30.796875 C 12.515625 -24.910156 13.578125 -19.796875 15.703125 -15.453125 C 17.828125 -11.109375 20.90625 -7.738281 24.9375 -5.34375 C 28.976562 -2.945312 33.664062 -1.75 39 -1.75 C 44.34375 -1.75 49.015625 -2.550781 53.015625 -4.15625 C 57.015625 -5.757812 60.332031 -8.410156 62.96875 -12.109375 C 65.601562 -15.804688 67.09375 -20.390625 67.4375 -25.859375 L 68.359375 -25.859375 L 67.234375 -11.796875 C 64.566406 -7.691406 60.695312 -4.457031 55.625 -2.09375 C 50.5625 0.257812 45.019531 1.4375 39 1.4375 Z M 39 1.4375 " />
                    </g>
                  </g>
                </g>
                <g fill="#5a0910" fillOpacity={1}>
                  <g transform="translate(850.911655, 98.843874)">
                    <g>
                      <path d="M 67.75 -1.03125 L 68.5625 -1.03125 L 68.5625 0 L 47.515625 0 L 47.515625 -1.03125 L 48.34375 -1.03125 C 49.644531 -1.03125 50.632812 -1.472656 51.3125 -2.359375 C 52 -3.242188 52.34375 -4.082031 52.34375 -4.875 C 52.34375 -5.664062 52.207031 -6.4375 51.9375 -7.1875 L 46.296875 -20.84375 L 20.328125 -20.84375 L 14.671875 -7.5 C 14.335938 -6.601562 14.171875 -5.757812 14.171875 -4.96875 C 14.171875 -4.1875 14.507812 -3.332031 15.1875 -2.40625 C 15.875 -1.488281 16.898438 -1.03125 18.265625 -1.03125 L 19.09375 -1.03125 L 19.09375 0 L -0.515625 0 L -0.515625 -1.03125 L 0.3125 -1.03125 C 1.75 -1.03125 3.203125 -1.523438 4.671875 -2.515625 C 6.140625 -3.503906 7.351562 -4.992188 8.3125 -6.984375 C 23.300781 -39.003906 31.101562 -55.769531 31.71875 -57.28125 C 32.875 -60.144531 33.488281 -62.054688 33.5625 -63.015625 L 34.484375 -63.015625 L 59.84375 -6.984375 C 61.820312 -3.015625 64.457031 -1.03125 67.75 -1.03125 Z M 21.65625 -23.921875 L 45.0625 -23.921875 L 33.5625 -52.03125 Z M 21.65625 -23.921875 " />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
          <path
            strokeLinecap="butt"
            transform="matrix(0.721041, -0.000000000000000089, 0.000000000000000089, 0.721041, -0.000000000000094185, 1196.222938)"
            fill="none"
            strokeLinejoin="miter"
            d="M 33.751126 4.501565 L 1464.517151 4.501565 "
            stroke="#730a13" className="pe-line"
            strokeWidth={9}
            strokeOpacity={1}
            strokeMiterlimit={4}
          />
          <path
            strokeLinecap="round"
            transform="matrix(0.721041, -0.000000000000000089, 0.000000000000000089, 0.721041, -0.000000000000094185, 1196.222938)"
            fillOpacity={1}
            fill="#730a13"
            fillRule="nonzero"
            strokeLinejoin="round"
            d="M 4.501956 4.501565 C 4.501956 -2.958355 10.542486 -8.998886 18.002406 -8.998886 C 25.456909 -8.998886 31.497439 -2.958355 31.497439 4.501565 C 31.497439 11.956067 25.456909 18.002015 18.002406 18.002015 C 10.542486 18.002015 4.501956 11.956067 4.501956 4.501565 "
            stroke="#730a13"
            className="pe-line-fill"
            strokeWidth={9}
            strokeOpacity={1}
            strokeMiterlimit={4}
          />
          <path
            fill="#730a13" className="pe-line-fill"
            d="M 1077.066406 1199.46875 C 1077.066406 1204.84375 1072.707031 1209.203125 1067.332031 1209.203125 C 1061.957031 1209.203125 1057.597656 1204.84375 1057.597656 1199.46875 C 1057.597656 1194.089844 1061.957031 1189.734375 1067.332031 1189.734375 C 1072.707031 1189.734375 1077.066406 1194.089844 1077.066406 1199.46875 "
            fillOpacity={1}
            fillRule="nonzero"
          />
          <g clipPath="url(#12a46c1608)">
            <path
              strokeLinecap="round"
              transform="matrix(0.721041, -0.000000000000000089, 0.000000000000000089, 0.721041, -0.000000000000094185, 1196.222938)"
              fill="none"
              strokeLinejoin="round"
              d="M 1493.76632 4.501565 C 1493.76632 11.956067 1487.720372 18.002015 1480.26587 18.002015 C 1472.811368 18.002015 1466.76542 11.956067 1466.76542 4.501565 C 1466.76542 -2.958355 1472.811368 -8.998886 1480.26587 -8.998886 C 1487.720372 -8.998886 1493.76632 -2.958355 1493.76632 4.501565 "
              stroke="#730a13" className="pe-line"
              strokeWidth={9}
              strokeOpacity={1}
              strokeMiterlimit={4}
            />
          </g>
          <g clipPath="url(#67cbd80896)">
            <path
              fill="#5a0910"
              d="M 361.296875 402.382812 C 360.832031 404.113281 361.8125 405.164062 362.332031 406.3125 C 388.527344 464.585938 414.746094 522.84375 440.917969 581.125 C 442.152344 583.882812 443.085938 586.410156 446.96875 586.027344 C 449.816406 585.746094 449.152344 588.007812 448.925781 589.734375 C 447.195312 602.898438 440.46875 613.273438 430.6875 621.800781 C 415.472656 635.066406 397.277344 642.109375 377.773438 645.78125 C 345.566406 651.839844 313.972656 649.914062 283.582031 636.746094 C 271.230469 631.394531 260.238281 624 251.570312 613.496094 C 245.773438 606.472656 241.832031 598.617188 240.597656 589.484375 C 240.21875 586.683594 240.972656 585.3125 243.980469 585.59375 C 246.152344 585.796875 247.65625 585.285156 248.734375 582.871094 C 276.5625 520.691406 304.476562 458.546875 332.46875 396.433594 C 333.847656 393.378906 333.785156 391.679688 331.136719 389.089844 C 321.875 380.023438 318.488281 368.554688 319.734375 355.828125 C 320.625 346.738281 329.804688 339.683594 338.726562 340.679688 C 343.859375 341.253906 347.746094 345.300781 347.914062 350.246094 C 348.085938 355.21875 345.445312 358.359375 339.699219 359.128906 C 336.878906 359.503906 336.714844 360.800781 337.15625 362.933594 C 337.804688 366.046875 339.410156 368.648438 341.660156 370.8125 C 350.628906 379.449219 361.0625 383.152344 373.390625 379.738281 C 385.011719 376.523438 395.824219 371.324219 406.40625 365.667969 C 424 356.265625 441.921875 347.742188 461.6875 343.894531 C 477.945312 340.730469 494.214844 337.746094 510.816406 341.535156 C 511.621094 341.714844 512.945312 341.824219 513.304688 341.382812 C 516.375 337.585938 522.488281 336.441406 521.984375 329.417969 C 521.566406 323.625 524.777344 318.652344 530.253906 315.957031 C 532.761719 314.722656 533.492188 313 533.617188 310.472656 C 533.976562 303.167969 534.425781 295.867188 534.9375 288.570312 C 535.082031 286.527344 534.394531 284.996094 533.222656 283.363281 C 530.652344 279.785156 531.164062 276.296875 534.324219 273.683594 C 537.632812 270.945312 542.835938 270.953125 546.09375 273.699219 C 549.234375 276.34375 549.957031 280.113281 547.324219 283.40625 C 545.464844 285.730469 545.253906 287.972656 545.519531 290.695312 C 546.183594 297.535156 546.699219 304.394531 547.117188 311.253906 C 547.246094 313.347656 547.773438 314.710938 549.835938 315.691406 C 556.066406 318.652344 558.597656 323.933594 558.679688 330.632812 C 558.753906 336.714844 565.84375 342.152344 571.902344 341.015625 C 586.28125 338.320312 600.488281 340.324219 614.609375 342.96875 C 633.902344 346.574219 651.855469 353.847656 669.105469 363.101562 C 680.570312 369.25 692.183594 375.128906 704.664062 379.066406 C 717.078125 382.984375 728.023438 380.445312 737.664062 371.835938 C 739.53125 370.167969 741.171875 368.3125 742.261719 366.023438 C 744.566406 361.175781 744.160156 360.230469 739.175781 358.867188 C 735.125 357.757812 732.386719 354.160156 732.519531 350.128906 C 732.667969 345.519531 736.183594 341.578125 740.894531 340.730469 C 749.675781 339.160156 759.167969 345.441406 760.371094 354.34375 C 762.226562 368.039062 758.542969 380.191406 748.296875 389.8125 C 746.46875 391.523438 746.484375 392.582031 747.359375 394.523438 C 775.597656 457.164062 803.8125 519.816406 831.945312 582.507812 C 833.003906 584.867188 834.230469 586.03125 836.808594 585.738281 C 839.808594 585.398438 840.074219 587.007812 839.707031 589.519531 C 838.003906 601.136719 832.648438 610.8125 824.246094 618.835938 C 808.460938 633.910156 789.09375 641.765625 768.054688 645.707031 C 736.492188 651.617188 705.414062 650.226562 675.464844 637.585938 C 662.511719 632.117188 651.023438 624.40625 641.960938 613.441406 C 636.242188 606.519531 632.613281 598.65625 631.332031 589.738281 C 630.972656 587.246094 631.15625 585.210938 634.492188 585.730469 C 637.722656 586.230469 638.300781 583.765625 639.25 581.660156 C 658.253906 539.550781 677.261719 497.445312 696.257812 455.339844 C 703.59375 439.082031 710.910156 422.820312 718.230469 406.554688 C 718.757812 405.378906 719.230469 404.175781 719.871094 402.648438 C 699.476562 403.277344 682.816406 393.449219 665.769531 385.015625 C 648.019531 376.234375 630.117188 368.039062 610.328125 364.984375 C 607.730469 364.582031 605.089844 364.445312 602.488281 364.050781 C 591.171875 362.320312 581.777344 365.992188 573.878906 374.050781 C 569.070312 378.957031 564.441406 384.089844 558.386719 387.5625 C 556.871094 388.433594 556.699219 389.375 557.773438 390.675781 C 558.796875 391.914062 559.742188 393.226562 560.816406 394.417969 C 564.925781 398.964844 565.253906 403.5 561.734375 408.566406 C 560.566406 410.246094 559.382812 411.921875 558.089844 413.507812 C 553.832031 418.75 552.945312 424.664062 553.753906 431.246094 C 558.253906 467.828125 562.589844 504.425781 566.992188 541.015625 C 567.597656 546.050781 566.683594 550.773438 563.265625 554.546875 C 561.117188 556.917969 561.777344 558.09375 563.726562 560.101562 C 578.230469 575.027344 584.574219 592.675781 580.480469 613.417969 C 578.3125 624.402344 572.53125 633.484375 564.132812 640.800781 C 561.890625 642.753906 561.804688 644.296875 563.195312 646.695312 C 565.421875 650.542969 567.960938 654.140625 571.449219 656.851562 C 582.378906 665.347656 593.921875 672.28125 608.671875 670.371094 C 613.519531 669.742188 617.992188 671.019531 622.035156 673.652344 C 628.039062 677.5625 633.9375 681.636719 639.945312 685.539062 C 641.355469 686.457031 642.109375 687.566406 641.84375 689.140625 C 641.179688 693.089844 643.511719 693.292969 646.484375 693.273438 C 654.675781 693.210938 662.871094 693.398438 671.066406 693.351562 C 674.914062 693.328125 677.828125 694.652344 679.839844 698.035156 C 682.609375 702.691406 685.738281 706.460938 692.144531 706.269531 C 695.621094 706.167969 697.839844 709.058594 697.859375 712.84375 C 697.875 716.222656 694.863281 719.507812 691.289062 720 C 689.707031 720.21875 688.078125 720.140625 686.46875 720.140625 C 588.734375 720.125 490.992188 720.105469 393.265625 720.078125 C 391.660156 720.074219 390.011719 720.148438 388.453125 719.839844 C 384.875 719.125 382.136719 715.636719 382.523438 712.191406 C 382.957031 708.3125 385.21875 705.886719 389.210938 706.117188 C 393.828125 706.386719 396.851562 704.25 398.753906 700.472656 C 401.648438 694.722656 406.148438 692.945312 412.394531 693.308594 C 419.828125 693.746094 427.3125 693.304688 434.773438 693.433594 C 437.507812 693.480469 439.019531 692.816406 438.515625 689.792969 C 438.160156 687.636719 439.117188 686.308594 440.953125 685.167969 C 446.914062 681.460938 452.804688 677.644531 458.664062 673.78125 C 463.316406 670.714844 468.441406 670.304688 473.808594 670.546875 C 490.160156 671.289062 502.421875 662.914062 513.664062 652.398438 C 514.5 651.613281 515.09375 650.546875 515.707031 649.554688 C 517.972656 645.898438 517.570312 642.578125 514.5 639.597656 C 493.753906 619.433594 493.179688 586.613281 513.582031 563.492188 C 517.296875 559.285156 519.957031 556.398438 515.214844 551.21875 C 512.835938 548.628906 513.171875 544.601562 513.570312 541.0625 C 516.074219 518.828125 518.550781 496.589844 521.171875 474.371094 C 522.917969 459.558594 524.867188 444.769531 526.769531 429.976562 C 527.59375 423.550781 526.394531 417.769531 521.878906 412.875 C 520.59375 411.480469 519.398438 409.984375 518.296875 408.4375 C 514.878906 403.644531 515.207031 399.039062 519.175781 394.746094 C 519.769531 394.105469 520.292969 393.390625 520.890625 392.75 C 523.332031 390.144531 523.734375 388.230469 519.902344 386.210938 C 516.433594 384.386719 513.605469 381.417969 511.105469 378.355469 C 500.570312 365.453125 487.273438 361.875 471.089844 364.808594 C 450.964844 368.453125 432.382812 375.933594 414.34375 385.136719 C 405.484375 389.660156 396.53125 393.964844 387.195312 397.433594 C 378.824219 400.542969 370.417969 403.453125 361.304688 402.371094 Z M 738.945312 396.859375 C 738.832031 398.886719 738.65625 400.582031 738.652344 402.277344 C 738.613281 461.527344 738.621094 520.777344 738.496094 580.027344 C 738.488281 583.4375 739.644531 584.097656 742.792969 584.128906 C 768.6875 584.371094 794.578125 584.71875 820.464844 585.246094 C 824.722656 585.332031 824.609375 584.089844 823.105469 580.894531 C 818.191406 570.449219 813.441406 559.921875 808.699219 549.394531 C 786.484375 500.085938 764.292969 450.765625 742.066406 401.464844 C 741.386719 399.957031 741.148438 398.113281 738.945312 396.859375 Z M 341.828125 397.597656 C 341.382812 397.46875 340.941406 397.34375 340.496094 397.214844 C 339.394531 399.527344 338.25 401.820312 337.195312 404.152344 C 322.957031 435.71875 308.703125 467.28125 294.5 498.867188 C 282.15625 526.320312 269.863281 553.796875 257.597656 581.285156 C 256.851562 582.957031 254.628906 585.320312 259.304688 585.234375 C 285.621094 584.742188 311.941406 584.390625 338.257812 584.152344 C 341.515625 584.125 342.015625 582.894531 342.007812 580.023438 C 341.890625 528.257812 341.867188 476.492188 341.824219 424.722656 C 341.820312 415.679688 341.824219 406.640625 341.824219 397.597656 Z M 729.683594 399.667969 C 701.699219 461.675781 673.941406 523.1875 646.0625 584.960938 C 647.179688 585.113281 647.746094 585.273438 648.304688 585.257812 C 674.773438 584.453125 701.25 584.050781 727.730469 584.167969 C 731.269531 584.183594 731.285156 582.449219 731.28125 579.839844 C 731.210938 521.46875 731.203125 463.09375 731.144531 404.726562 C 731.140625 403.367188 731.734375 401.835938 729.683594 399.671875 Z M 434.65625 584.96875 C 406.402344 523.226562 379.199219 461.535156 350.75 399.335938 C 348.972656 402.1875 349.382812 403.820312 349.378906 405.34375 C 349.371094 463.539062 349.4375 521.738281 349.328125 579.933594 C 349.320312 583.640625 350.667969 584.136719 353.851562 584.160156 C 376.078125 584.332031 398.300781 584.6875 420.523438 584.960938 C 425.023438 585.015625 429.523438 584.96875 434.652344 584.96875 Z M 540.269531 377.082031 C 548.941406 377.050781 555.777344 370.40625 555.824219 361.964844 C 555.875 353.554688 549.007812 346.679688 540.46875 346.589844 C 531.851562 346.496094 524.890625 353.25 524.914062 361.667969 C 524.9375 370.046875 531.980469 377.113281 540.269531 377.082031 Z M 540.269531 377.082031 "
              fillOpacity={1}
              fillRule="nonzero"
            />
          </g>
        </g>
      </g>
    </g>
  </svg>
  );
}
