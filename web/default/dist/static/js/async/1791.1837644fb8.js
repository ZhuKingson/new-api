"use strict";(self.rspackChunknewapi_web=self.rspackChunknewapi_web||[]).push([[1791],{80146(e,a,r){r.r(a),r.d(a,{component:()=>p});var t=r(39974),l=r(38390),s=r(62519),o=r(65649),n=r(93361),i=r(96699),d=r(21283);let c=[{key:"product-photo",label:"Product Photo",prompt:`生成一张真实感很强的日常家居用品产品摄影图。

产品设定：
- 产品是一只高品质陶瓷香薰加湿器，适合放在卧室床头柜或客厅边几
- 外观为温润米白色陶瓷，圆润但不夸张，表面有细微手工釉面纹理
- 顶部有非常轻的雾气溢出，旁边放一小瓶天然精油和一块浅色亚麻布

拍摄要求：
- 画面必须像真实相机拍摄所得，不要像 3D 渲染图、广告合成图或插画
- 使用自然窗光，柔和阴影，浅景深，背景轻微虚化
- 构图干净真实，有生活气息，但不要过度摆拍
- 保留产品真实比例和材质细节，陶瓷、玻璃、布料和木质桌面的触感要可信
- 不要出现文字、Logo、水印、海报排版或 UI 元素
- 横向画幅，适合后续作为电商网站或品牌官网的主视觉素材`},{key:"portrait",label:"Portrait",prompt:"请生成一张自然光人像照片，肤色真实，保留皮肤纹理，浅景深，背景干净，不要文字和水印。"},{key:"food",label:"Food",prompt:"请生成一张高级餐厅风格的食物摄影图，强调食材细节与蒸汽氛围，柔和侧光，写实风格，不要文字和logo。"}],p=function(){let{t:e}=(0,s.Bd)(),[a,r]=(0,l.useState)(c[0].prompt),[p,u]=(0,l.useState)(!1),[m,g]=(0,l.useState)(""),h=async()=>{if(!a.trim())return void o.oR.error(e("Please enter a prompt."));u(!0);try{let r=await fetch("/api/user/image-chat/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:a})}),t=await r.json();if(!r.ok)return void o.oR.error(t.message||e("Image generation failed."));let l=t.output?.find(e=>"image_generation_call"===e.type&&e.result);if(!l?.result)return void o.oR.error(e("No image returned from model response."));g(l.result),o.oR.success(e("Image generated successfully."))}catch{o.oR.error(e("Image generation failed."))}finally{u(!1)}};return(0,t.jsxs)("div",{className:"mx-auto flex w-full max-w-6xl flex-col gap-4 p-4",children:[(0,t.jsxs)(d.Zp,{children:[(0,t.jsx)(d.aR,{children:(0,t.jsx)(d.ZB,{children:e("Image Chat (GPT-5.5 + GPT-Image-2)")})}),(0,t.jsxs)(d.Wu,{className:"space-y-4",children:[(0,t.jsx)("div",{className:"flex flex-wrap gap-2",children:c.map(e=>(0,t.jsx)(n.$,{variant:"outline",onClick:()=>r(e.prompt),children:e.label},e.key))}),(0,t.jsx)(i.T,{value:a,onChange:e=>r(e.target.value),rows:12,placeholder:e("Describe the image you want to generate...")}),(0,t.jsx)("div",{className:"flex gap-2",children:(0,t.jsx)(n.$,{onClick:h,disabled:p,children:p?e("Generating..."):e("Generate Image")})})]})]}),m?(0,t.jsxs)(d.Zp,{children:[(0,t.jsx)(d.aR,{children:(0,t.jsx)(d.ZB,{children:e("Generated Result")})}),(0,t.jsx)(d.Wu,{children:(0,t.jsx)("img",{src:`data:image/png;base64,${m}`,alt:e("Generated image"),className:"w-full rounded-md border"})})]}):null]})}}}]);