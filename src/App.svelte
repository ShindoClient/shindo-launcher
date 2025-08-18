<script lang="ts">
  import Router from "svelte-spa-router";
  import TitleBar from "@/components/TitleBar.svelte";
  import NavBar from "@/components/NavBar.svelte";
  import UpdatePage from "@/pages/UpdatePage.svelte";
  import HomePage from "@/pages/HomePage.svelte";
  import SettingsPage from "@/pages/SettingsPage.svelte";

  const routes = {
    "/": HomePage,
    "/update": UpdatePage,
    "/settings": SettingsPage
  };
</script>

<div class="h-screen w-screen bg-gray-950 text-white overflow-hidden">
  <TitleBar />
  <NavBar />
  <div class="pt-8 ml-48 h-[calc(100vh-2rem)]">
    <Router {routes} />
  </div>
</div>
