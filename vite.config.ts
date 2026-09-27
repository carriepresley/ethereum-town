import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {nitro} from 'nitro/vite';
export default defineConfig({
 resolve:{tsconfigPaths:true},
 build:{sourcemap:false},
 plugins:[tanstackStart({server:{entry:'server'}}),nitro(),react()],
});
