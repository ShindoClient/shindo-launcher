import { createRouter, createWebHashHistory } from "vue-router";
import UpdateScreen from "./screens/UpdateScreen.vue";
import HomeScreen from "./screens/HomeScreen.vue";
import SettingsScreen from "./screens/SettingsScreen.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: UpdateScreen },
    { path: "/home", component: HomeScreen },
    { path: "/settings", component: SettingsScreen },
  ],
});
