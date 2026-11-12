<style lang="scss">
  @import "uview-plus/index.scss";
  @import "style/index.scss";
</style>
<template>

</template>
<script>
  import axios from 'axios'
  // #ifdef APP-PLUS
  import { createUniAppAxiosAdapter } from "@uni-helper/axios-adapter";
  // #endif

  export default
  {
    onLaunch()
    {
      uni.vm = this;
      // #ifdef APP-PLUS
      axios.defaults.adapter = createUniAppAxiosAdapter();
      uni.cxapp.Service.server = 'http://192.168.2.207:39092/oadev/zgis'
      // #endif
      uni.vm.$axios = axios;
      this.refresh = false;
      uni.cxapp.LoadingInterceptor.start()
    },
    onShow()
    {},
    onHide() {},
  }
</script>
