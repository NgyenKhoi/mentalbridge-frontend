import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
const require=createRequire(new URL('../../package.json',import.meta.url))
const {JSDOM}=require('jsdom')
const source=await readFile(new URL('./baseline-desktop.html',import.meta.url),'utf8')
const dom=new JSDOM(source)
const document=dom.window.document
document.querySelectorAll('script,link,style,nextjs-portal').forEach(node=>node.remove())
document.head.innerHTML='<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Community · Interactive fixture prototype</title><link rel="stylesheet" href="captured-baseline.css"><link rel="stylesheet" href="prototype.css">'
document.querySelector('.community-shell-main').innerHTML='<div class="social-prototype-note">Prototype tương tác · dữ liệu mô phỏng, không gọi API nghiệp vụ.<button id="simulate-error">Thử lỗi thao tác kế tiếp</button></div><div id="prototype-content"></div>'
document.querySelectorAll('body > :not(.community-shell)').forEach(node=>node.remove())
const script=document.createElement('script');script.src='prototype.js';document.body.append(script)
await writeFile(new URL('./community-interactive-prototype.html',import.meta.url),dom.serialize())
console.log('Built shell-integrated prototype from verified full-frame Community route DOM')
