<script lang="ts" setup>
interface IProps {
  themeName: string
}

defineProps<IProps>()
</script>

<template>
  <section class="content-wrapper">
    <slot name="story" />
  </section>
</template>

<style lang="scss">
body {
  user-select: text !important;
}

html {
  overflow: scroll;
}

.sb-show-main.sb-main-padded {
  padding: 0;
}

#storybook-root,
.sb-story {
  border-radius: var(--r-xs);
  overflow: hidden;
  min-height: 100vh;
  position: relative;
  margin: 0 auto;
  background-color: var(--bg-primary-color);
}
</style>
