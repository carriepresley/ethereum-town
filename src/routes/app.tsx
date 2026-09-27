import {createFileRoute,redirect} from '@tanstack/react-router';
// Keep the scaffold route while excluding its unused generation UI from this website.
export const Route=createFileRoute('/app')({beforeLoad:()=>{throw redirect({to:'/',replace:true})}});
