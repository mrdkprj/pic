import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()]
    },
    preload: {
        build:{
            lib:{
                entry:"src/main/preload.ts"
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        build:{
            rollupOptions:{
                input:{
                    main_window:"src/renderer/main/index.html",
                    edit_window:"src/renderer/edit/index.html",
                }
            }
        },
        plugins: [svelte()]
    }
})