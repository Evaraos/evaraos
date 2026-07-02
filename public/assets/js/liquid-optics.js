const SVG_ID="evaraLiquidOptics";

function buildFilters(){
  const host=document.createElementNS("http://www.w3.org/2000/svg","svg");
  host.id=SVG_ID;
  host.setAttribute("aria-hidden","true");
  host.setAttribute("width","0");
  host.setAttribute("height","0");
  host.style.cssText="position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
  host.innerHTML=`<defs>
    <filter id="evara-liquid-refraction" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.0025 0.0045" numOctaves="1" seed="7" result="field"/>
      <feGaussianBlur in="field" stdDeviation="1.35" result="smoothField"/>
      <feDisplacementMap in="SourceGraphic" in2="smoothField" scale="4" xChannelSelector="R" yChannelSelector="B" result="lens"/>
      <feGaussianBlur in="lens" stdDeviation="0.18"/>
    </filter>
    <filter id="evara-liquid-refraction-clear" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.0035 0.006" numOctaves="1" seed="13" result="field"/>
      <feGaussianBlur in="field" stdDeviation="1.1" result="smoothField"/>
      <feDisplacementMap in="SourceGraphic" in2="smoothField" scale="6" xChannelSelector="R" yChannelSelector="B" result="lens"/>
      <feGaussianBlur in="lens" stdDeviation="0.12"/>
    </filter>
    <filter id="evara-liquid-refraction-thick" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.0018 0.0032" numOctaves="1" seed="19" result="field"/>
      <feGaussianBlur in="field" stdDeviation="1.6" result="smoothField"/>
      <feDisplacementMap in="SourceGraphic" in2="smoothField" scale="7" xChannelSelector="R" yChannelSelector="B" result="lens"/>
      <feGaussianBlur in="lens" stdDeviation="0.34"/>
    </filter>
  </defs>`;
  return host;
}

export function installLiquidOptics(){
  if(document.getElementById(SVG_ID))return;
  const mount=()=>{
    if(document.getElementById(SVG_ID))return;
    (document.body||document.documentElement).prepend(buildFilters());
    document.documentElement.dataset.liquidOptics="enabled";
    dispatchEvent(new CustomEvent("evara:liquid-optics-ready"));
  };
  document.body?mount():document.addEventListener("DOMContentLoaded",mount,{once:true});
}

if(typeof window!=="undefined"){
  window.EvaraLiquidOptics={install:installLiquidOptics};
  installLiquidOptics();
}
