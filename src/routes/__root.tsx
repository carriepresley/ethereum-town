import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Outlet,Link,createRootRouteWithContext,HeadContent,Scripts} from '@tanstack/react-router';
import type {ReactNode} from 'react';
import appCss from '../styles.css?url';
import meta from '../app-meta.json';
function Shell({children}:{children:ReactNode}){return <html lang="en"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
function Root(){const {queryClient}=Route.useRouteContext();return <QueryClientProvider client={queryClient}><Outlet/></QueryClientProvider>}
function NotFound(){return <main style={{padding:40}}><h1>Street not found</h1><Link to="/">Return to Ethereum Town</Link></main>}
function ErrorPage({reset}:{reset:()=>void}){return <main style={{padding:40}}><h1>The town could not load</h1><p>Please try again.</p><button onClick={reset}>Try again</button></main>}
export const Route=createRootRouteWithContext<{queryClient:QueryClient}>()({head:()=>({meta:[{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},{title:meta.og_title},{name:'description',content:meta.og_description},{property:'og:title',content:meta.og_title},{property:'og:description',content:meta.og_description},{property:'og:type',content:'website'},{property:'og:image',content:meta.og_image_url},{name:'twitter:card',content:'summary_large_image'}],links:[{rel:'stylesheet',href:appCss},{rel:'icon',href:'/favicon.svg'}]}),shellComponent:Shell,component:Root,notFoundComponent:NotFound,errorComponent:ErrorPage});
