const SVG_ID="evaraLiquidOptics";

function buildFilters(){
  const host=document.createElementNS("http://www.w3.org/2000/svg","svg");
  host.id=SVG_ID;
  host.setAttribute("aria-hidden","true");
  host.setAttribute("width","0");
  host.setAttribute("height","0");
  host.style.cssText="position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
  host.innerHTML=`<defs>
    <filter id="evara-liquid-refraction" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.016" numOctaves="1" seed="11" result="noise"/>
      <feGaussianBlur in="noise" stdDeviation="0.55" result="softNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="9" xChannelSelector="R" yChannelSelector="B" result="warped"/>
      <feGaussianBlur in="warped" stdDeviation="0.34"/>
    </filter>
    <filter id="evara-liquid-refraction-clear" x="-16%" y="-16%" width="132%" height="132%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.021" numOctaves="1" seed="17" result="noise"/>
      <feGaussianBlur in="noise" stdDeviation="0.42" result="softNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="13" xChannelSelector="R" yChannelSelector="B" result="warped"/>
      <feGaussianBlur in="warped" stdDeviation="0.22"/>
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
