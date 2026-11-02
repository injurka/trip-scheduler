import View from '~/components/05.modules/public-pages/ui/about-view.vue'
import { createStaticPageApp } from '../app'
import '../styles'

createStaticPageApp(View).mount('#static-page')
