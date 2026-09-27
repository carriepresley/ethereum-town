import * as THREE from 'three';

/** Original procedural town. Walker counts are supplied without normalization. */
export function mountTown(container, chains, onSelect = () => {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9ebe3');
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
  renderer.domElement.setAttribute('aria-label','Interactive Ethereum city: a central Ethereum town hall connected by bridges to Layer 2 neighborhoods. Drag to orbit, scroll to zoom, or select a building, bridge, or Ethereum staking beacon.');
  renderer.domElement.tabIndex=0;container.appendChild(renderer.domElement);
  const camera=new THREE.OrthographicCamera(-38,38,26,-26,.1,250),clock=new THREE.Clock();
  const town=new THREE.Group();scene.add(town);
  const ethereum=chains.find(c=>c.id==='ethereum'||c.kind==='l1');
  const layerTwos=chains.filter(c=>c.id!==ethereum?.id&&c.kind!=='l1').slice(0,12);
  const districtRadius=layerTwos.length>6?31+(layerTwos.length-7)*1.7:27,coreRadius=districtRadius+11.5;
  const financeOverviewZoom=Math.min(.82,(coreRadius+2.5)/67);
  const materials=new Map(),geometries=new Map(),textures=[];
  const mat=(color,roughness=.88,metalness=0)=>{const k=color+':'+roughness+':'+metalness;if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(k);};
  const boxGeo=new THREE.BoxGeometry(1,1,1),cylinderGeo=new THREE.CylinderGeometry(1,1,1,8),sphereGeo=new THREE.IcosahedronGeometry(1,0);
  geometries.set('box',boxGeo);geometries.set('cylinder',cylinderGeo);geometries.set('sphere',sphereGeo);
  function box(parent,x,y,z,w,h,d,color,cast=true){const m=new THREE.Mesh(boxGeo,typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;}
  function cyl(parent,x,y,z,r,h,color){const m=new THREE.Mesh(cylinderGeo,mat(color));m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function poly(parent,x,y,z,r,color,squash=1){const m=new THREE.Mesh(sphereGeo,mat(color));m.position.set(x,y,z);m.scale.set(r,r*squash,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const hemi=new THREE.HemisphereLight('#edf4fa','#9da48b',1.65);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffe5bb',2.1);sun.position.set(-32,44,35);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:64,bottom:-64,far:180});sun.shadow.normalBias=.03;sun.shadow.bias=-.00008;scene.add(sun);
  const fill=new THREE.DirectionalLight('#deefff',.6);fill.position.set(25,25,-30);scene.add(fill);
  const roundGeo=new THREE.CylinderGeometry(1,1,1,80);geometries.set('round',roundGeo);
  function disk(parent,x,y,z,r,h,color){const m=new THREE.Mesh(roundGeo,typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  disk(town,0,-1.02,0,coreRadius,1.35,'#c5d9d4');
  const waterMaterial=mat('#71b7cb',.39,.03);
  const water=disk(town,0,-.36,0,coreRadius-.25,.14,waterMaterial);water.castShadow=false;
  disk(town,0,-1.73,0,coreRadius-.5,.12,'#aabeb9');
  const floor=box(scene,0,-1.9,0,1000,.12,1000,'#e9ebe3',false);
  const pavement=mat('#d7d5c8'),cream=mat('#f1edde'),glass=mat('#284957',.25,.16);
  function tree(x,z,s=1){cyl(town,x,.65*s,z,.14*s,1.3*s,'#8b7353');poly(town,x,1.65*s,z,.85*s,'#91a570',1.17);poly(town,x+.33*s,1.65*s,z-.12*s,.54*s,'#a5b581',1.15);box(town,x,.08,z,1.5*s,.18,1.5*s,'#b7b6a3');}
  // Original hand-drawn paving and soft lamp pools give the model a tactile feel.
  const tileCanvas=document.createElement('canvas');tileCanvas.width=tileCanvas.height=256;
  const tileContext=tileCanvas.getContext('2d');tileContext.fillStyle='#d6d3c4';tileContext.fillRect(0,0,256,256);
  for(let row=0;row<4;row++)for(let col=-1;col<5;col++){const x=col*64+(row%2)*32,y=row*64;tileContext.fillStyle=['#e7e1cf','#ddd8c8','#e1dccd','#d9d5c6'][(row+col+5)%4];tileContext.fillRect(x+1,y+1,62,62);tileContext.fillStyle='rgba(255,255,245,.32)';tileContext.fillRect(x+2,y+2,60,2);}
  const tileTexture=new THREE.CanvasTexture(tileCanvas);tileTexture.colorSpace=THREE.SRGBColorSpace;tileTexture.wrapS=tileTexture.wrapT=THREE.RepeatWrapping;tileTexture.repeat.set(4,4);tileTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(tileTexture);
  const pathMaterial=new THREE.MeshStandardMaterial({map:tileTexture,roughness:.98});materials.set('pavingTexture',pathMaterial);
  const planeGeo=new THREE.PlaneGeometry(1,1);geometries.set('detailPlane',planeGeo);
  function pavedPatch(parent,x,z,w,d,y=.301){const mesh=new THREE.Mesh(planeGeo,pathMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.scale.set(w,d,1);mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const poolCanvas=document.createElement('canvas');poolCanvas.width=poolCanvas.height=128;const poolContext=poolCanvas.getContext('2d'),gradient=poolContext.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,216,130,.9)');gradient.addColorStop(.35,'rgba(255,206,115,.35)');gradient.addColorStop(1,'rgba(255,191,95,0)');poolContext.fillStyle=gradient;poolContext.fillRect(0,0,128,128);
  const poolTexture=new THREE.CanvasTexture(poolCanvas);poolTexture.colorSpace=THREE.SRGBColorSpace;textures.push(poolTexture);
  const poolMaterial=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,opacity:0,depthWrite:false,toneMapped:false});materials.set('lampPool',poolMaterial);
  const lamps=[],lampPools=[];
  function lamp(x,z){cyl(town,x,1.7,z,.045,3.4,'#46575b');box(town,x+.27,3.36,z,.6,.065,.07,'#46575b');const glow=new THREE.MeshStandardMaterial({color:'#fff4c7',emissive:'#ffd987',emissiveIntensity:.35,roughness:.35});materials.set('lamp'+lamps.length,glow);box(town,x+.5,3.3,z,.3,.08,.3,glow,false);lamps.push(glow);const pool=new THREE.Mesh(planeGeo,poolMaterial);pool.rotation.x=-Math.PI/2;pool.position.set(x+.5,.319,z);pool.scale.set(4.3,4.3,1);town.add(pool);lampPools.push(pool);}
  const chainRoots=new Map(),hits=[],walkers=[],rings=[],roofWindows=[],locations=[],packets=[],brandMarks=[],validatorAngles=[];
  const bridgeRoutes=new Map(),seenBridgeEvents=new Set(),observedBlocks=new Map(),walkerSeeds=new Map(),livePulses=new Map();
  const financeGroup=new THREE.Group(),financeIds=new Set();financeGroup.visible=false;town.add(financeGroup);
  let validatorLights=null,stakingNetwork=null;
  // Water ripples are fixed decorative strokes, never an activity series.
  for(let i=0;i<24;i++){const a=i*2.399,r=14+(i%5)*4;box(town,Math.sin(a)*r,-.275,Math.cos(a)*r,1.2+(i%3)*.3,.014,.08,'#b9e2ec',false);}
  function textTexture(chain){
    const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=chain.color||'#6f7f71';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=3;ctx.strokeRect(16,16,992,224);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
    const name=String(chain.name||chain.id).toUpperCase();let fs=148;ctx.font=`700 ${fs}px system-ui, sans-serif`;while(ctx.measureText(name).width>915&&fs>38){fs-=2;ctx.font=`700 ${fs}px system-ui, sans-serif`;}ctx.fillText(name,512,107);ctx.font='500 34px system-ui, sans-serif';ctx.fillStyle='rgba(255,255,255,.8)';ctx.fillText(chain.id===ethereum?.id?'ETH  /  SETTLEMENT LAYER':String(chain.symbol||'').toUpperCase()+'  /  ETHEREUM L2',512,196);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(t);return t;
  }
  function label(group,chain,w,h,y,z,back=false){const material=new THREE.MeshBasicMaterial({map:textTexture(chain),toneMapped:false});materials.set('label'+materials.size,material);const geo=new THREE.PlaneGeometry(w,h);geometries.set('label'+geometries.size,geo);const mesh=new THREE.Mesh(geo,material);mesh.position.set(0,y,z);if(back)mesh.rotation.y=Math.PI;group.add(mesh);}
  function bench(group,x,z,turn=0){const b=new THREE.Group();b.position.set(x,.24,z);b.rotation.y=turn;group.add(b);box(b,0,.4,0,1.35,.12,.4,'#a27c50');box(b,0,.77,-.17,1.35,.48,.09,'#a27c50');for(const s of [-1,1])box(b,s*.49,.18,0,.06,.35,.28,'#4a5b59');}
  function planter(parent,x,z,w=1.2,d=.52,y=.3){
    box(parent,x,y+.20,z,w,.40,d,'#b19474');box(parent,x,y+.405,z,w-.10,.03,d-.08,'#526947');
    for(let k=0;k<4;k++){const xx=x-w*.35+k*w*.235;poly(parent,xx,y+.50,z,.18,'#718c57',.8);if(k%2===0)poly(parent,xx+.05,y+.62,z+.03,.075,k?'#dcaf7c':'#d3a2a4',.8);}
  }
  function cafe(parent,x,z,color){
    const cafeGroup=new THREE.Group();cafeGroup.position.set(x,.3,z);parent.add(cafeGroup);
    cyl(cafeGroup,0,.39,0,.055,.78,'#6c786e');cyl(cafeGroup,0,.81,0,.63,.10,'#c0a681');cyl(cafeGroup,0,1.6,0,.035,1.6,'#a09270');
    const canopyGeo=new THREE.ConeGeometry(1.05,.38,8);geometries.set('parasol'+geometries.size,canopyGeo);const canopy=new THREE.Mesh(canopyGeo,mat(color));canopy.position.y=2.45;canopy.castShadow=true;cafeGroup.add(canopy);
    for(const side of [-1,1]){box(cafeGroup,side*.84,.41,0,.43,.1,.44,'#b39b75');box(cafeGroup,side*1.02,.7,0,.07,.5,.44,'#b39b75');for(const zz of [-.15,.15])box(cafeGroup,side*.84,.21,zz,.07,.40,.06,'#687569');}
  }
  function bicycle(parent,x,z){
    const b=new THREE.Group();b.position.set(x,.32,z);parent.add(b);const wheelGeo=new THREE.TorusGeometry(.25,.035,5,12);geometries.set('bicycle'+geometries.size,wheelGeo);
    for(const xx of [-.42,.42]){const wheel=new THREE.Mesh(wheelGeo,mat('#576765'));wheel.position.set(xx,.25,0);b.add(wheel);}
    const vertices=[-.42,.25,0,-.10,.62,0,-.10,.62,0,.20,.25,0,.20,.25,0,-.42,.25,0,.20,.25,0,.28,.64,0,.28,.64,0,.42,.25,0,-.10,.62,0,.28,.64,0];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometries.set('bicycleFrame'+geometries.size,geo);const material=new THREE.LineBasicMaterial({color:'#b57855'});materials.set('bicycleFrame'+materials.size,material);b.add(new THREE.LineSegments(geo,material));box(b,-.10,.66,0,.23,.055,.12,'#465550');box(b,.29,.75,0,.04,.2,.035,'#637471');box(b,.27,.84,0,.2,.035,.05,'#637471');
  }
  function selectionRing(id,x,z,r,color){
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false});materials.set('selection'+id,material);
    const geo=new THREE.RingGeometry(r,r+.16,80);geometries.set('selection'+id,geo);
    const ring=new THREE.Mesh(geo,material);ring.rotation.x=-Math.PI/2;ring.position.set(x,.325,z);town.add(ring);rings.push({id,mesh:ring});
  }
  function buildBridge(chain,angle,index){
    const bridge=new THREE.Group();bridge.rotation.y=angle;town.add(bridge);
    const innerDeck=10.1,outerDeck=districtRadius-5.4,center=(innerDeck+outerDeck)/2,length=outerDeck-innerDeck;
    const deck=box(bridge,0,.31,center,2.8,.32,length,'#e7dfc9');deck.userData.chainId=chain.id;hits.push(deck);
    box(bridge,0,.11,center,3.05,.15,length+.2,chain.color||'#8497c6');
    for(const side of [-1,1]){
      box(bridge,side*1.42,1.02,center,.11,.12,length+.2,'#eee9da');
      box(bridge,side*1.42,.70,center,.055,.065,length+.2,'#b8c0be');
      for(let d=10.2;d<=outerDeck;d+=1.15)box(bridge,side*1.42,.72,d,.13,.69,.13,'#f2ead7');
    }
    for(const d of [innerDeck+1.1,center,outerDeck-1.4]){
      for(const side of [-1,1])cyl(bridge,side*1.10,-.22,d,.21,1.1,'#adbbb6');
      box(bridge,0,-.04,d,2.8,.2,.38,'#c7ccc0');
    }
    for(let d=10.6;d<=outerDeck-.4;d+=.6)box(bridge,0,.478,d,2.6,.015,.035,'#cec6b3',false);
    bridgeRoutes.set(chain.id,{angle,inner:10.6,outer:districtRadius-5.9,color:chain.color||'#8ea2d4'});
  }
  function buildStakingFoundation(parent){
    const foundation=new THREE.Group();parent.add(foundation);chainRoots.set('staking',foundation);
    locations.push({chain:{id:'staking',name:'ETH staking'},x:0,z:0});
    // Illustrative architecture: these beacons do not encode actual validator counts.
    const bandGeo=new THREE.RingGeometry(9.74,10.30,96);geometries.set('stakingBand',bandGeo);
    const bandMat=mat('#899cac',.65,.08);const band=new THREE.Mesh(bandGeo,bandMat);band.rotation.x=-Math.PI/2;band.position.y=.307;band.userData.chainId='staking';foundation.add(band);hits.push(band);
    const edgeGeo=new THREE.TorusGeometry(10.25,.065,6,96);geometries.set('stakingEdge',edgeGeo);const edge=new THREE.Mesh(edgeGeo,mat('#637d9b',.5,.12));edge.rotation.x=Math.PI/2;edge.position.y=.37;foundation.add(edge);
    // Omit the bridge spokes to keep all bridge entrances unobstructed.
    for(let i=0;i<48;i++){const a=i*Math.PI/24;const atBridge=layerTwos.some((_,j)=>{const b=(j+.5)*Math.PI*2/Math.max(1,layerTwos.length),d=Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));return d<.12;});if(!atBridge&&i%4!==0)validatorAngles.push(a);}
    const lightMat=new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#709fe4',emissiveIntensity:.24,roughness:.32,metalness:.12});materials.set('validatorLight',lightMat);
    validatorLights=new THREE.InstancedMesh(sphereGeo,lightMat,validatorAngles.length);validatorLights.instanceMatrix.setUsage(THREE.StaticDrawUsage);validatorLights.castShadow=true;validatorLights.userData.chainId='staking';foundation.add(validatorLights);hits.push(validatorLights);
    const transform=new THREE.Object3D(),vertices=[];
    validatorAngles.forEach((a,i)=>{
      const x=Math.sin(a)*10.02,z=Math.cos(a)*10.02;
      cyl(foundation,x,.40,z,.23,.19,'#bec8cc');cyl(foundation,x,.73,z,.105,.52,'#718498');cyl(foundation,x,1.01,z,.22,.10,'#d4e0e5');
      transform.position.set(x,1.20,z);transform.scale.set(.22,.28,.22);transform.rotation.y=a;transform.updateMatrix();validatorLights.setMatrixAt(i,transform.matrix);validatorLights.setColorAt(i,new THREE.Color('#8dafdf'));
      const next=validatorAngles[(i+1)%validatorAngles.length];vertices.push(x,.325,z,Math.sin(next)*10.02,.325,Math.cos(next)*10.02);
      if(i%5===0){const n=validatorAngles[(i+3)%validatorAngles.length];vertices.push(x,.326,z,Math.sin(n)*10.02,.326,Math.cos(n)*10.02);}
    });
    validatorLights.instanceMatrix.needsUpdate=true;validatorLights.computeBoundingSphere();
    const graphGeo=new THREE.BufferGeometry();graphGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometries.set('validatorGraph',graphGeo);
    const graphMat=new THREE.LineBasicMaterial({color:'#79a6df',transparent:true,opacity:.42,depthWrite:false});materials.set('validatorGraph',graphMat);stakingNetwork=new THREE.LineSegments(graphGeo,graphMat);foundation.add(stakingNetwork);
    selectionRing('staking',0,0,10.36,'#79a6df');
    // A discreet plaque on the foundation gives the ring an obvious click target.
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#536b8a';ctx.fillRect(0,0,768,160);ctx.fillStyle='#eef5ff';ctx.font='600 74px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('ETH STAKING',384,83);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const plaqueMat=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});materials.set('stakingPlaque',plaqueMat);
    const plaqueGeo=new THREE.PlaneGeometry(4.1,.85);geometries.set('stakingPlaque',plaqueGeo);const plaque=new THREE.Mesh(plaqueGeo,plaqueMat);plaque.position.set(0,.72,10.53);plaque.rotation.x=-.32;plaque.userData.chainId='staking';foundation.add(plaque);hits.push(plaque);
  }
  if(ethereum){
    const g=new THREE.Group();town.add(g);chainRoots.set(ethereum.id,g);locations.push({chain:ethereum,x:0,z:0});
    disk(g,0,-.17,0,11.15,.78,'#bbc7b0');disk(g,0,.15,0,10.97,.28,'#dddccc');pavedPatch(g,0,0,15.0,15.0,.296);
    for(const side of [-1,1]){planter(g,side*7.5,0,1.1,3.0);planter(g,side*5.7,7.7,1.8,.62);}
    const plazaRingGeo=new THREE.RingGeometry(9.82,10.03,96);geometries.set('plazaRing',plazaRingGeo);
    const plazaRing=new THREE.Mesh(plazaRingGeo,mat('#aebbae'));plazaRing.rotation.x=-Math.PI/2;plazaRing.position.y=.298;g.add(plazaRing);
    const body=box(g,0,4.8,0,11.2,8.6,7.2,'#f4eedb');body.userData.chainId=ethereum.id;hits.push(body);
    box(g,0,.58,0,12.2,.6,8.2,'#cfc9b7');box(g,0,8.87,0,12.3,.3,9.9,'#d6cdb9');
    for(const face of [-1,1]){
      // Wide shallow civic steps and an open colonnade on both facades.
      for(let step=0;step<4;step++)box(g,0,.37+step*.17,face*(6.8-step*.48),11.7-step*.35,.2,1.8,'#e8e1cc');
      for(const x of [-4.8,-2.4,0,2.4,4.8]){
        cyl(g,x,4.1,face*4.62,.32,6.35,'#eee9d5');cyl(g,x,1.01,face*4.62,.47,.28,'#d8cfb7');cyl(g,x,7.22,face*4.62,.49,.24,'#e1d8c0');
      }
      box(g,0,7.79,face*4.68,12.0,.9,1.45,'#e9e1cb');box(g,0,8.38,face*4.68,12.5,.3,1.72,'#ccc4ae');
      label(g,ethereum,10.8,1.30,7.71,face*5.60,face<0);
      for(const x of [-3.7,0,3.7]){
        const wm=new THREE.MeshStandardMaterial({color:'#536e82',emissive:'#f7d993',emissiveIntensity:0,roughness:.3,metalness:.1});materials.set('hallWindow'+materials.size,wm);roofWindows.push(wm);
        box(g,x,4.08,face*3.63,1.65,4.6,.08,wm,false);box(g,x,4.1,face*3.70,.08,4.6,.055,'#e5dbc3');box(g,x,4.1,face*3.70,1.65,.08,.055,'#e5dbc3');
      }
    }
    for(const side of [-1,1])for(const z of [-2.15,0,2.15]){box(g,side*5.64,4.6,z,.08,3.9,1.3,glass,false);box(g,side*5.70,4.6,z,.055,.08,1.3,'#e4dac4');}
    const roofGeo=new THREE.ConeGeometry(1,1,4);geometries.set('civicRoof',roofGeo);
    const roof=new THREE.Mesh(roofGeo,mat('#718593',.6,.1));roof.position.y=9.86;roof.rotation.y=Math.PI/4;roof.scale.set(8.95,2.2,7.35);roof.castShadow=true;roof.receiveShadow=true;g.add(roof);
    disk(g,0,11.35,0,2.6,1.8,'#e6ddc6');disk(g,0,12.3,0,2.84,.24,'#d2c6ad');
    const domeGeo=new THREE.SphereGeometry(2.75,24,12,0,Math.PI*2,0,Math.PI/2);geometries.set('civicDome',domeGeo);const dome=new THREE.Mesh(domeGeo,mat('#93aeb5',.5,.14));dome.position.y=12.43;dome.castShadow=true;g.add(dome);
    disk(g,0,15.27,0,.65,.4,'#dfd8c5');
    // Faceted split-diamond Ethereum monument. Its face turns gently with the view.
    const triangles=[
      [[0,3.3],[-1.8,0],[0,.7],'#b0c1ec'],[[0,3.3],[0,.7],[1.8,0],'#7695d2'],
      [[-1.8,0],[0,-1],[0,.7],'#819acd'],[[1.8,0],[0,.7],[0,-1],'#4d6ba5'],
      [[-1.8,-.6],[0,-3.3],[0,-1.6],'#8aa4dc'],[[1.8,-.6],[0,-1.6],[0,-3.3],'#49659c'],
    ];
    const vertices=[],colors=[];for(const tri of triangles){const c=new THREE.Color(tri[3]);for(let i=0;i<3;i++){vertices.push(tri[i][0],tri[i][1],0);colors.push(c.r,c.g,c.b);}}
    const ethGeo=new THREE.BufferGeometry();ethGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));ethGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));ethGeo.computeVertexNormals();geometries.set('ethDiamond',ethGeo);
    const ethMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false});materials.set('ethDiamond',ethMat);
    const mark=new THREE.Mesh(ethGeo,ethMat);mark.position.y=18.82;mark.rotation.y=.2;mark.userData.chainId=ethereum.id;g.add(mark);hits.push(mark);brandMarks.push(mark);
    for(const side of [-1,1])for(const z of [-4.6,4.6]){tree(side*8.2,z,.88);lamp(side*7.25,z*1.25);bench(g,side*8.35,z*.44,side*Math.PI/2);}
    selectionRing(ethereum.id,0,0,10.65,ethereum.color||'#859cd2');
    makeWalkers(ethereum,0,0,17);
    buildStakingFoundation(g);
  }
  layerTwos.forEach((chain,index)=>{
    const angle=(index+.5)*Math.PI*2/Math.max(1,layerTwos.length),x=Math.sin(angle)*districtRadius,z=Math.cos(angle)*districtRadius;
    disk(town,x,-.19,z,8.25,.75,'#bdc6b0');disk(town,x,.16,z,8.1,.24,'#d8d7c7');
    buildBridge(chain,angle,index);
    for(let k=0;k<8;k++){const a=k*Math.PI/4;tree(x+Math.sin(a)*7.25,z+Math.cos(a)*7.25,.65);}
    const group=new THREE.Group();group.position.set(x,0,z);town.add(group);locations.push({chain,x,z});chainRoots.set(chain.id,group);
    box(group,0,.13,0,10.8,.32,12,pavement);pavedPatch(group,0,0,10.8,12);for(let ix=-4;ix<=4;ix++)for(const iz of [-5.8,5.8])box(group,ix,.305,iz,.018,.011,.3,'#b8b9ad',false);
    const h=index%3===0?6.7:index%3===1?6.4:6.9,bw=7.3,bd=6.8;
    const body=box(group,0,h/2+.3,0,bw,h,bd,cream);body.userData.chainId=chain.id;hits.push(body);
    box(group,0,.63,0,bw+.14,.56,bd+.14,'#c9c5b5');box(group,0,h+.25,0,bw+.35,.22,bd+.35,'#d1cbb9');box(group,0,h+.43,0,bw-.28,.2,bd-.28,'#b8b9ad');
    for(const sz of [-1,1])box(group,0,h+.57,sz*3.31,bw+.2,.46,.16,'#e5e0d2');for(const sx of [-1,1])box(group,sx*3.62,h+.57,0,.16,.46,bd,'#e5e0d2');
    box(group,-1.8,h+.77,-1.1,1.35,.6,1.55,'#b0b7ae');for(let q=-2;q<=2;q++)box(group,-1.8+q*.18,h+1.085,-1.1,.08,.035,1.19,'#737f7b');
    // A tiny roof terrace and planted corners make each shop a lived-in place.
    planter(group,-2.35,2.0,1.45,.55,h+.54);planter(group,2.5,-2.2,.60,1.45,h+.54);cafe(group,.70,-1.2,index%2?'#dcc79e':'#91a6a1');
    const terrace=group.children[group.children.length-1];terrace.position.y=h+.55;
    for(const sz of [-1,1])for(let stripe=0;stripe<4;stripe++)box(group,-.9+stripe*.6,.313,sz*5.45,.38,.017,.80,'#f1edde',false);
    bicycle(group,3.95,2.6);planter(group,-3.6,5.15,1.5,.54);cyl(group,1.9,h+.75,1.5,.36,.56,'#96a39d');cyl(group,1.9,h+1.05,1.5,.44,.09,'#647972');
    for(const face of [-1,1]){
      for(const wx of [-2.35,0,2.35]){
        box(group,wx,1.8,face*3.423,1.72,2.32,.065,glass,false);box(group,wx,1.8,face*3.49,.065,2.32,.06,'#dcdfd6');box(group,wx,1.76,face*3.49,1.72,.055,.06,'#dcdfd6');
        const wm=new THREE.MeshStandardMaterial({color:'#65838a',roughness:.25,metalness:.1,emissive:'#fdce7f',emissiveIntensity:0});materials.set('win'+roofWindows.length,wm);roofWindows.push(wm);box(group,wx,h-.95,face*3.423,1.31,1.32,.065,wm,false);box(group,wx,h-.95,face*3.47,.04,1.32,.045,'#e4decd');box(group,wx,h-1.65,face*3.47,1.52,.12,.18,'#dbd4c1');if(wx!==0)planter(group,wx,face*3.56,1.10,.26,h-1.72);
      }
      for(let stripe=0;stripe<14;stripe++){
        const color=stripe%2===0?(chain.color||'#617b6d'):'#faf4e6';const aw=box(group,-3.38+stripe*.52,3.33,face*3.95,.525,.095,1.24,color);aw.rotation.x=face*.16;box(group,-3.38+stripe*.52,3.15,face*4.51,.525,.23,.08,color);
      }
      label(group,chain,6.70,1.30,4.08,face*3.49,face<0);box(group,.49,1.47,face*3.53,.045,.5,.085,'#b7ac88');box(group,0,.38,face*3.83,1.92,.16,.56,'#ebe6d7');
    }
    for(const sx of [-1,1])for(const sz of [-1.9,1.9]){box(group,sx*3.675,2.05,sz,.07,1.92,1.14,glass,false);box(group,sx*3.71,2.05,sz,.045,1.92,.045,'#d2d8d1');}
    bench(group,4.56,-1.5,Math.PI/2);bench(group,-4.56,1.5,-Math.PI/2);tree(x-4.6,z-4.65,.7);tree(x+4.6,z+4.65,.7);lamp(x-4.8,z+4.3);lamp(x+4.8,z-4.3);box(group,4.55,.61,1.5,.48,.6,.5,'#64756b');box(group,-4.4,.64,-3.7,.55,.64,.55,'#9c9f80');poly(group,-4.4,1.12,-3.7,.47,'#80996e',.78);
    const rm=new THREE.MeshBasicMaterial({color:chain.color||'#829976',transparent:true,opacity:0,depthWrite:false});materials.set('ring'+index,rm);const rg=new THREE.RingGeometry(5.35,5.47,48);geometries.set('ring'+index,rg);const ring=new THREE.Mesh(rg,rm);ring.rotation.x=-Math.PI/2;ring.position.set(x,.335,z);town.add(ring);rings.push({id:chain.id,mesh:ring});
    makeWalkers(chain,x,z,index);
  });
  const dummy=new THREE.Object3D();
  function seeded(n){const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);}
  function makeWalkers(chain,x,z,seed){
    walkerSeeds.set(chain.id,seed);
    const count=Math.max(0,Math.round(Number(chain.visitorCount)||0));if(!count)return;
    const bg=new THREE.BoxGeometry(.27,.40,.20),hg=new THREE.IcosahedronGeometry(.13,1),lg=new THREE.BoxGeometry(.075,.25,.085);geometries.set('body'+seed,bg);geometries.set('head'+seed,hg);geometries.set('leg'+seed,lg);
    const bodies=new THREE.InstancedMesh(bg,mat('#ffffff'),count),heads=new THREE.InstancedMesh(hg,mat('#ffffff'),count),legs=new THREE.InstancedMesh(lg,mat('#33474d'),count*2);
    for(const m of [bodies,heads,legs]){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.frustumCulled=false;town.add(m);}
    const people=[];
    for(let i=0;i<count;i++){const r=seeded(i+seed*4921+37),r2=seeded(i*17+seed*1921+9);people.push({p:r*36.8,v:(.35+r2*.45)*(i%3===0?-1:1),lane:((i%5)-2)*.17,phase:r2*6.28,size:1.10+seeded(i*127+3)*.30});const wardrobe=[chain.color||'#668297','#668297','#b67558','#e4d2ab','#6f866b','#c49a5e','#d7c2be'],skin=['#d9af85','#a77757','#78543f','#efc8a3','#bb8b68'];bodies.setColorAt(i,new THREE.Color(wardrobe[Math.floor(seeded(i*51+2)*wardrobe.length)]));heads.setColorAt(i,new THREE.Color(skin[Math.floor(seeded(i*83+1)*skin.length)]));}
    walkers.push({id:chain.id,x,z,bodies,heads,legs,people,seed,geos:[bg,hg,lg],hub:chain.id===ethereum?.id});
  }
  function hubPosition(distance,lane){const r=9.2+lane,a=distance/r;return{x:Math.sin(a)*r,z:Math.cos(a)*r,a:a+Math.PI/2};}
  function loopPosition(distance,lane){const w=9.1+lane,h=9.3+lane,p=2*(w+h);let d=((distance%p)+p)%p;if(d<w)return{x:-w/2+d,z:-h/2,a:Math.PI/2};d-=w;if(d<h)return{x:w/2,z:-h/2+d,a:0};d-=h;if(d<w)return{x:w/2-d,z:h/2,a:-Math.PI/2};d-=w;return{x:-w/2,z:h/2-d,a:Math.PI};}
  function updateWalkers(time){
    for(const w of walkers){for(let i=0;i<w.people.length;i++){
      const p=w.people[i],pos=w.hub?hubPosition(p.p+time*p.v,p.lane):loopPosition(p.p+time*p.v,p.lane),a=pos.a+(p.v<0?Math.PI:0),bob=Math.sin(time*6+p.phase)*.018,px=w.x+pos.x,pz=w.z+pos.z;
      dummy.position.set(px,.29+.45*p.size+bob,pz);dummy.rotation.set(0,a,0);dummy.scale.setScalar(p.size);dummy.updateMatrix();w.bodies.setMatrixAt(i,dummy.matrix);dummy.position.y=.29+.78*p.size+bob;dummy.updateMatrix();w.heads.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<2;j++){const side=j===0?-1:1;dummy.position.set(px+Math.cos(a)*side*.080*p.size,.29+.125*p.size,pz-Math.sin(a)*side*.080*p.size);dummy.rotation.set(Math.sin(time*7+p.phase+j*Math.PI)*.43,a,0);dummy.updateMatrix();w.legs.setMatrixAt(i*2+j,dummy.matrix);}
    }w.bodies.instanceMatrix.needsUpdate=true;w.heads.instanceMatrix.needsUpdate=true;w.legs.instanceMatrix.needsUpdate=true;}
  }
  // The optional district is a selected set of products and possibilities, not an
  // assertion that entire financial institutions have moved onchain.
  const financeSites=[
    {id:'jpmcoin',company:'JPMORGAN',product:'JPM COIN',status:'LIVE PRODUCT / BASE',target:'base',angle:Math.PI/3,color:'#557788',type:'live'},
    {id:'buidl',company:'BLACKROCK',product:'BUIDL',status:'LIVE PRODUCT / ETHEREUM',target:'ethereum',angle:Math.PI,color:'#697478',type:'live'},
    {id:'benji',company:'FRANKLIN TEMPLETON',product:'BENJI',status:'LIVE PRODUCT / ARBITRUM',target:'arbitrum',angle:Math.PI*2/3,color:'#7a8294',type:'live'},
    {id:'visa',company:'VISA',product:'SETTLEMENT',status:'PILOT / ETHEREUM',target:'ethereum',angle:0,color:'#8c947c',type:'pilot'},
    {id:'future-banks',company:'BANKS',product:'OPPORTUNITY',status:'POSSIBLE FUTURE USE',target:'ethereum',angle:Math.PI*4/3,color:'#99aeba',type:'future'},
    {id:'future-insurance',company:'INSURANCE',product:'OPPORTUNITY',status:'POSSIBLE FUTURE USE',target:'ethereum',angle:Math.PI*5/3,color:'#99aeba',type:'future'},
  ];
  function financeLabel(site){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle=site.color;ctx.fillRect(0,0,1024,320);ctx.fillStyle='#f6f7f4';ctx.textAlign='center';ctx.textBaseline='middle';
    let size=60;ctx.font=`600 ${size}px system-ui,sans-serif`;while(ctx.measureText(site.company).width>950){size-=2;ctx.font=`600 ${size}px system-ui,sans-serif`;}ctx.fillText(site.company,512,61);
    size=112;ctx.font=`700 ${size}px system-ui,sans-serif`;while(ctx.measureText(site.product).width>950){size-=2;ctx.font=`700 ${size}px system-ui,sans-serif`;}ctx.fillText(site.product,512,163);ctx.font='500 33px system-ui,sans-serif';ctx.fillText(site.status,512,265);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(texture);const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});materials.set('financeLabel'+site.id,material);return material;
  }
  disk(financeGroup,0,-1.27,0,62.0,.71,'#c5d9d4');
  const outerWaterGeo=new THREE.RingGeometry(coreRadius-.4,61.75,128);geometries.set('outerWater',outerWaterGeo);const outerWater=new THREE.Mesh(outerWaterGeo,waterMaterial);outerWater.rotation.x=-Math.PI/2;outerWater.position.y=-.29;outerWater.receiveShadow=true;financeGroup.add(outerWater);
  const outerLabelGeo=new THREE.PlaneGeometry(7.05,2.2);geometries.set('outerLabel',outerLabelGeo);
  const ghostEdgesGeo=new THREE.EdgesGeometry(boxGeo);geometries.set('ghostEdges',ghostEdgesGeo);
  const ghostLineMat=new THREE.LineBasicMaterial({color:'#7793a5',transparent:true,opacity:.70});materials.set('ghostEdges',ghostLineMat);
  for(const site of financeSites){
    const x=Math.sin(site.angle)*53,z=Math.cos(site.angle)*53;
    const g=new THREE.Group();g.position.set(x,0,z);financeGroup.add(g);financeIds.add(site.id);chainRoots.set(site.id,g);locations.push({chain:{id:site.id,name:site.company,kind:'finance'},x,z});
    disk(g,0,-.15,0,7.45,.79,site.type==='future'?'#d5dedc':'#bcc9b8');disk(g,0,.19,0,7.31,.20,'#e0e0d2');
    const ghost=site.type==='future';const bodyMat=ghost?new THREE.MeshStandardMaterial({color:'#bed0d5',transparent:true,opacity:.24,roughness:.8,depthWrite:false}):cream;if(ghost)materials.set('ghost'+site.id,bodyMat);
    const body=box(g,0,4.27,0,7.8,7.9,6.6,bodyMat,!ghost);body.userData.chainId=site.id;hits.push(body);
    if(ghost){const wire=new THREE.LineSegments(ghostEdgesGeo,ghostLineMat);wire.position.copy(body.position);wire.scale.copy(body.scale);g.add(wire);for(const h of [2.2,4.4,6.6]){const floorWire=new THREE.LineSegments(ghostEdgesGeo,ghostLineMat);floorWire.position.set(0,h,0);floorWire.scale.set(7.8,.02,6.6);g.add(floorWire);}}
    else{
      box(g,0,.64,0,8.1,.55,6.9,'#c6cbbb');box(g,0,8.26,0,8.4,.29,7.1,'#c7cec5');box(g,0,8.52,0,8.0,.26,6.8,'#7c8b8e');
      for(const face of [-1,1])for(const wx of [-2.65,0,2.65])for(const wy of [1.85,6.35]){box(g,wx,wy,face*3.335,1.58,2.12,.06,glass,false);box(g,wx,wy,face*3.385,.07,2.12,.045,'#e1e4d8');}
      for(const side of [-1,1])for(const sz of [-1.8,1.8])box(g,side*3.925,4.35,sz,.06,4.7,1.33,glass,false);
      box(g,-1.9,8.91,-1.1,1.6,.53,1.7,'#aab8b4');for(let j=0;j<5;j++)box(g,-2.42+j*.26,9.19,-1.1,.10,.025,1.36,'#738782');
      for(const px of [-4.7,4.7]){cyl(g,px,.95,3.6,.13,1.4,'#8b7353');poly(g,px,2.05,3.6,.9,'#9aae84',1.1);}
    }
    const signMat=financeLabel(site);
    for(const face of [-1,1]){const labelMesh=new THREE.Mesh(outerLabelGeo,signMat);labelMesh.position.set(0,4.0,face*3.43);if(face<0)labelMesh.rotation.y=Math.PI;g.add(labelMesh);}
    const target=locations.find(loc=>loc.chain.id===site.target);
    if(target){const start=new THREE.Vector3(x,-.16,z),end=new THREE.Vector3(target.x,-.16,target.z),direction=end.clone().sub(start).normalize();start.addScaledVector(direction,7.4);end.addScaledVector(direction,-(site.target==='ethereum'?11.25:8.25));
      if(site.type==='live'){const geo=new THREE.TubeGeometry(new THREE.LineCurve3(start,end),1,.13,6,false);geometries.set('financePath'+site.id,geo);const path=new THREE.Mesh(geo,mat('#8aadb2',.72));path.userData.chainId=site.id;financeGroup.add(path);hits.push(path);}
      else{const geo=new THREE.BufferGeometry().setFromPoints([start,end]);geometries.set('financePath'+site.id,geo);const material=new THREE.LineDashedMaterial({color:site.type==='pilot'?'#91a79b':'#a6b8bf',dashSize:site.type==='pilot'?.20:1.1,gapSize:site.type==='pilot'?.47:.9,transparent:true,opacity:.9});materials.set('financePath'+site.id,material);const path=new THREE.Line(geo,material);path.computeLineDistances();financeGroup.add(path);}
    }
    // These product paths are static; no institution volume is fabricated.
  }
  // Batch static geometry to keep the detailed scene responsive on laptops.
  town.updateMatrixWorld(true);
  const batches=new Map(),dynamicRoots=new Set([financeGroup,...packets.map(p=>p.g)]),pickable=new Set(hits);
  town.traverse(obj=>{
    if(!obj.isMesh||obj.isInstancedMesh||pickable.has(obj)||obj.material.transparent)return;
    let p=obj.parent;while(p){if(dynamicRoots.has(p))return;p=p.parent;}
    const key=obj.geometry.uuid+':'+obj.material.uuid+':'+obj.castShadow;
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(obj);
  });
  for(const objects of batches.values()){
    if(objects.length<2)continue;
    const first=objects[0],batch=new THREE.InstancedMesh(first.geometry,first.material,objects.length);
    batch.castShadow=first.castShadow;batch.receiveShadow=true;
    objects.forEach((obj,i)=>{batch.setMatrixAt(i,obj.matrixWorld);obj.removeFromParent();});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();town.add(batch);
  }
  const financeBatches=new Map();financeGroup.updateMatrixWorld(true);
  financeGroup.traverse(o=>{if(!o.isMesh||o.material.transparent||pickable.has(o))return;const key=o.geometry.uuid+':'+o.material.uuid+':'+o.castShadow;if(!financeBatches.has(key))financeBatches.set(key,[]);financeBatches.get(key).push(o);});
  for(const objects of financeBatches.values()){if(objects.length<2)continue;const first=objects[0],batch=new THREE.InstancedMesh(first.geometry,first.material,objects.length);batch.castShadow=first.castShadow;batch.receiveShadow=true;objects.forEach((o,i)=>{batch.setMatrixAt(i,o.matrixWorld);o.removeFromParent();});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();financeGroup.add(batch);}
  let paused=false,speed=1,elapsed=0,raf=0,disposed=false,financeVisible=false,selected=null,azimuth=.24,elevation=.74,targetElevation=.74,zoom=1,targetZoom=1;
  const focus=new THREE.Vector3(0,2.5,0),targetFocus=new THREE.Vector3(0,2.5,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let dragging=false,startX=0,startY=0,lastX=0,lastY=0,dragDistance=0;
  function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h);const a=w/h;const size=Math.max(35,(coreRadius+2.5)/a);camera.left=-size*a;camera.right=size*a;camera.top=size;camera.bottom=-size;camera.updateProjectionMatrix();}
  const ro=new ResizeObserver(resize);ro.observe(container);resize();
  function select(id,notify=false){if(['stablecoins','defi','tokenized-assets','data-availability','app-rollups'].includes(id))id=ethereum?.id||null;else if(id==='liquid-staking')id='staking';if(id&&financeIds.has(id)&&!financeVisible){financeVisible=true;financeGroup.visible=true;}selected=id&&chainRoots.has(id)?id:null;const loc=locations.find(v=>v.chain.id===selected);if(loc){targetFocus.set(loc.x,loc.chain.id==='staking'?5:loc.chain.id===ethereum?.id?7:3,loc.z);targetZoom=financeIds.has(loc.chain.id)?2.65:loc.chain.id==='staking'?1.95:loc.chain.id===ethereum?.id?2.15:3.8;targetElevation=loc.chain.id==='staking'?.72:loc.chain.id===ethereum?.id?.64:.56;}else{targetFocus.set(0,2.5,0);targetZoom=financeVisible?financeOverviewZoom:1;targetElevation=financeVisible?.78:.74;}if(notify)onSelect(selected);}
  function pick(event){const r=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-r.left)/r.width)*2-1;pointer.y=-((event.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(hits.filter(o=>!financeIds.has(o.userData.chainId)||financeVisible),false)[0]?.object.userData.chainId||null;}
  const down=e=>{dragging=true;startX=lastX=e.clientX;startY=lastY=e.clientY;dragDistance=0;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';};
  const move=e=>{if(dragging){const dx=e.clientX-lastX,dy=e.clientY-lastY;dragDistance=Math.hypot(e.clientX-startX,e.clientY-startY);azimuth-=dx*.006;elevation=Math.max(.35,Math.min(1.2,elevation+dy*.004));targetElevation=elevation;lastX=e.clientX;lastY=e.clientY;}else renderer.domElement.style.cursor=pick(e)?'pointer':'grab';};
  const up=e=>{if(!dragging)return;dragging=false;renderer.domElement.style.cursor='grab';if(dragDistance<6)select(pick(e),true);};
  const wheel=e=>{e.preventDefault();targetZoom=Math.max(.48,Math.min(5.0,targetZoom*Math.exp(-e.deltaY*.001)));};
  const key=e=>{if(e.key==='Escape')select(null,true);if(e.key==='ArrowLeft')azimuth-=.12;if(e.key==='ArrowRight')azimuth+=.12;if(e.key==='+'||e.key==='=')targetZoom=Math.min(5.0,targetZoom*1.12);if(e.key==='-')targetZoom=Math.max(.48,targetZoom/1.12);};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});renderer.domElement.addEventListener('keydown',key);
  function setNight(value){const night=!!value;scene.background.set(night?'#182c38':'#e9ebe3');floor.material=mat(night?'#182c38':'#e9ebe3');hemi.intensity=night?.64:1.65;sun.intensity=night?.50:2.1;sun.color.set(night?'#9db9dd':'#ffe5bb');fill.intensity=night?.24:.6;renderer.toneMappingExposure=night?1.18:1.03;for(const m of lamps)m.emissiveIntensity=night?4:.35;for(const m of roofWindows)m.emissiveIntensity=night?.9:0;waterMaterial.color.set(night?'#25495a':'#71b7cb');glass.emissive.set('#edb879');glass.emissiveIntensity=night?.55:0;for(const pool of lampPools)pool.material.opacity=night?.42:0;}
  function setLiveActivity(records){
    if(disposed||!Array.isArray(records))return;
    for(const record of records){
      const loc=locations.find(v=>v.chain.id===record.id);if(!loc||!walkerSeeds.has(record.id))continue;
      const rawCount=record.visitorCount===undefined?Number(record.transactions)/10:Number(record.visitorCount);
      if(!Number.isFinite(rawCount)||rawCount<0)continue;
      const count=Math.round(rawCount),existing=walkers.find(w=>w.id===record.id);
      if((existing?.people.length||0)!==count){
        if(existing){for(const mesh of [existing.bodies,existing.heads,existing.legs]){mesh.removeFromParent();mesh.dispose();}for(const geo of existing.geos)geo.dispose();for(const prefix of ['body','head','leg'])geometries.delete(prefix+existing.seed);walkers.splice(walkers.indexOf(existing),1);}
        makeWalkers({...loc.chain,visitorCount:count},loc.x,loc.z,walkerSeeds.get(record.id));
      }
      const key=record.blockHash||String(record.blockNumber??'');if(!key||observedBlocks.get(record.id)===key)continue;observedBlocks.set(record.id,key);
      let pulse=livePulses.get(record.id);
      if(!pulse){const radius=record.id===ethereum?.id?10.7:6.4,geo=new THREE.RingGeometry(radius,radius+.20,72);geometries.set('livePulse'+record.id,geo);const material=new THREE.MeshBasicMaterial({color:loc.chain.color||'#769dcd',transparent:true,opacity:0,depthWrite:false});materials.set('livePulse'+record.id,material);const mesh=new THREE.Mesh(geo,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(loc.x,.39,loc.z);town.add(mesh);pulse={mesh,started:elapsed};livePulses.set(record.id,pulse);}
      pulse.started=elapsed;
    }
  }
  function showBridgeEvents(events){
    if(disposed||!Array.isArray(events))return;
    for(const event of events){
      const route=bridgeRoutes.get(event.chainId);if(!route||!event.id||seenBridgeEvents.has(event.id)||!['to-l1','to-l2'].includes(event.direction))continue;
      seenBridgeEvents.add(event.id);while(seenBridgeEvents.size>200)seenBridgeEvents.delete(seenBridgeEvents.values().next().value);
      // Only a verified, previously unseen event creates a moving packet.
      const g=new THREE.Group();town.add(g);box(g,0,0,0,.42,.34,.55,route.color);box(g,0,.20,0,.27,.06,.36,'#f5f4e9');
      const radius=event.direction==='to-l1'?route.outer:route.inner;g.position.set(Math.sin(route.angle)*radius,.94,Math.cos(route.angle)*radius);g.rotation.y=route.angle;
      packets.push({g,angle:route.angle,inner:route.inner,outer:route.outer,direction:event.direction,started:elapsed,id:event.id});
      if(packets.length>80){packets.shift().g.removeFromParent();}
    }
  }
  function setFinanceVisible(value){const changed=financeVisible!==!!value;financeVisible=!!value;financeGroup.visible=financeVisible;if(changed)select(null,true);else if(selected===null){targetZoom=financeVisible?financeOverviewZoom:1;targetFocus.set(0,2.5,0);}}
  const validatorColor=new THREE.Color();
  function animate(){if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused)elapsed+=dt*speed;updateWalkers(elapsed);for(let i=packets.length-1;i>=0;i--){const packet=packets[i],t=(elapsed-packet.started)/6;if(t>=1){packet.g.removeFromParent();packets.splice(i,1);continue;}const r=packet.direction==='to-l1'?packet.outer-t*(packet.outer-packet.inner):packet.inner+t*(packet.outer-packet.inner);packet.g.position.set(Math.sin(packet.angle)*r,.94,Math.cos(packet.angle)*r);packet.g.rotation.y=packet.angle;}for(const pulse of livePulses.values()){const t=(elapsed-pulse.started)/2.4;pulse.mesh.visible=t>=0&&t<1;pulse.mesh.material.opacity=Math.max(0,(1-t)*.74);pulse.mesh.scale.setScalar(1+Math.max(0,t)*.18);}
    if(validatorLights){
      const active=selected==='staking';
      validatorAngles.forEach((a,i)=>{const wave=Math.pow((Math.sin(a*2-elapsed*1.35)+1)/2,5);validatorColor.set('#83a5d4').multiplyScalar(.70+wave*(active?.70:.37));validatorLights.setColorAt(i,validatorColor);});
      validatorLights.instanceColor.needsUpdate=true;validatorLights.material.emissiveIntensity=active?.8:.24;
      stakingNetwork.material.opacity=(active?.65:.30)+Math.sin(elapsed*1.35)*.07;
    }
    const ease=1-Math.exp(-dt*5);focus.lerp(targetFocus,ease);elevation+=(targetElevation-elevation)*ease;zoom+=(targetZoom-zoom)*ease;camera.zoom=zoom;camera.updateProjectionMatrix();const r=100;camera.position.set(focus.x+Math.sin(azimuth)*Math.cos(elevation)*r,focus.y+Math.sin(elevation)*r,focus.z+Math.cos(azimuth)*Math.cos(elevation)*r);camera.lookAt(focus);for(const mark of brandMarks)mark.rotation.y=azimuth;for(const ring of rings)ring.mesh.material.opacity+=((ring.id===selected?.9:0)-ring.mesh.material.opacity)*ease;renderer.render(scene,camera);
  }
  animate();
  return {
    select:id=>select(id),setPaused:value=>{paused=!!value;},setSpeed:value=>{speed=Math.max(0,Math.min(8,Number(value)||0));},setNight,
    setScale:()=>{},getCanvas:()=>renderer.domElement,setLiveActivity,showBridgeEvents,setFinanceVisible,
    dispose:()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);ro.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',up);renderer.domElement.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('keydown',key);for(const t of textures)t.dispose();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();});sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}
