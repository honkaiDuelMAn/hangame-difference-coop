// These native surface widths keep sampling stable at common display scales.
// Keep both CSS and device dimensions integral to avoid a second resampling.
const surfaces=[128,160,200,256,320,400,512,640,800,960,1280,1600,1920,2560,3200,3840];
export function fitGameFrame(section){
 const update=()=>{
  const ratio=window.devicePixelRatio||1;
  const available=(section.getBoundingClientRect().width-2)*ratio;
  let physical=0;
  for(const value of surfaces){
   const css=value/ratio;
   if(value<=available*1.02&&Math.abs(css/4-Math.round(css/4))<.0001)physical=value;
  }
  const width=physical?physical/ratio:Math.max(4,Math.floor(available/ratio/4)*4);
  section.style.setProperty('--game-width',(width+2)+'px');
  section.style.setProperty('--game-height',(width*3/4+2)+'px');
 };
 const observer=new ResizeObserver(update);observer.observe(section);
 window.addEventListener('resize',update);update();
}
