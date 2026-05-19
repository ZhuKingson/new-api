"use strict";(self.rspackChunknewapi_web=self.rspackChunknewapi_web||[]).push([[1791],{80146(e,r,a){a.r(r),a.d(r,{component:()=>p});var s=a(39974),l=a(38390),t=a(62519),o=a(65649),n=a(93361),i=a(96699),c=a(21283);let d=[{key:"product-photo",label:"产品摄影",prompt:`生成一张真实感很强的日常家居用品产品摄影图。

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
- 横向画幅，适合后续作为电商网站或品牌官网的主视觉素材`},{key:"portrait",label:"人物写真",prompt:"请生成一张自然光人像照片，肤色真实，保留皮肤纹理，浅景深，背景干净，不要文字和水印。"},{key:"food",label:"美食摄影",prompt:"请生成一张高级餐厅风格的食物摄影图，强调食材细节与蒸汽氛围，柔和侧光，写实风格，不要文字和 logo。"}],p=function(){let{t:e}=(0,t.Bd)(),[r,a]=(0,l.useState)(d[0].prompt),[p,m]=(0,l.useState)(!1),[u,h]=(0,l.useState)(""),x=async()=>{if(!r.trim())return void o.oR.error(e("请输入图像描述。"));m(!0);let a=new AbortController,s=window.setTimeout(()=>a.abort(),18e4);try{let s=await fetch("/api/user/image-chat/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:r}),signal:a.signal}),l=await s.json();if(!s.ok||!1===l.success)return void o.oR.error(l.message||e("图像生成失败。"));let t=(l.data?.output||l.output||[]).find(e=>"image_generation_call"===e.type&&e.result);if(!t?.result)return void o.oR.error(l.message||e("模型没有返回图像结果。"));h(t.result),o.oR.success(e("图像生成成功。"))}catch(r){r instanceof Error&&"AbortError"===r.name?o.oR.error(e("生成超时，请稍后重试。")):o.oR.error(e("图像生成失败。"))}finally{window.clearTimeout(s),m(!1)}};return(0,s.jsxs)("div",{className:"mx-auto w-full max-w-6xl p-4",children:[(0,s.jsxs)(c.Zp,{children:[(0,s.jsx)(c.aR,{className:"pb-4",children:(0,s.jsx)(c.ZB,{children:e("文生图（GPT-5.5 + GPT-Image-2）")})}),(0,s.jsxs)(c.Wu,{className:"space-y-4",children:[(0,s.jsx)("div",{className:"flex flex-wrap gap-2",children:d.map(e=>(0,s.jsx)(n.$,{variant:"outline",onClick:()=>a(e.prompt),children:e.label},e.key))}),(0,s.jsx)(i.T,{value:r,onChange:e=>a(e.target.value),rows:10,className:"min-h-[220px] resize-y leading-7",placeholder:e("请输入你想生成的图像描述，例如：场景、风格、光线、构图。")}),(0,s.jsx)("div",{className:"flex flex-wrap items-center gap-3",children:(0,s.jsx)(n.$,{onClick:x,disabled:p,className:"min-w-28",children:p?e("生成中..."):e("生成图片")})})]})]}),u?(0,s.jsxs)(c.Zp,{className:"mt-4",children:[(0,s.jsx)(c.aR,{children:(0,s.jsx)(c.ZB,{children:e("生成结果")})}),(0,s.jsx)(c.Wu,{children:(0,s.jsx)("img",{src:`data:image/png;base64,${u}`,alt:e("生成图片结果"),className:"w-full rounded-md border object-contain"})})]}):null]})}}}]);