<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { NavigationBack } from '~/components/02.shared/navigation-back'

useHead({
  title: 'Лицензии Open Source',
})

interface License {
  package: string
  license: string
  version: string
  author: string
  link: string
}

const licenses = ref<License[]>([
  { package: '@internationalized/date', license: 'Apache-2.0', version: '3.10.0', author: 'Adobe Inc.', link: 'https://github.com/adobe/react-spectrum' },
  { package: '@mapbox/polyline', license: 'BSD-3-Clause', version: '1.2.1', author: 'Mapbox', link: 'https://github.com/mapbox/polyline' },
  { package: '@milkdown/crepe', license: 'MIT', version: '7.17.1', author: 'Mirone', link: 'https://github.com/Milkdown/milkdown' },
  { package: '@milkdown/kit', license: 'MIT', version: '7.17.1', author: 'Mirone', link: 'https://github.com/Milkdown/milkdown' },
  { package: '@milkdown/vue', license: 'MIT', version: '7.17.1', author: 'Mirone', link: 'https://github.com/Milkdown/milkdown' },
  { package: '@trpc/client', license: 'MIT', version: '11.7.1', author: 'tRPC team', link: 'https://github.com/trpc/trpc' },
  { package: '@vueuse/core', license: 'MIT', version: '14.0.0', author: 'Anthony Fu & VueUse contributors', link: 'https://github.com/vueuse/vueuse' },
  { package: '@vueuse/head', license: 'MIT', version: '2.0.0', author: 'VueUse team', link: 'https://github.com/vueuse/head' },
  { package: 'chart.js', license: 'MIT', version: '4.5.1', author: 'Chart.js contributors', link: 'https://github.com/chartjs/Chart.js' },
  { package: 'maska', license: 'MIT', version: '3.2.0', author: 'be-hold', link: 'https://github.com/beholdr/maska' },
  { package: 'ofetch', license: 'MIT', version: '1.5.1', author: 'Pooya Parsa', link: 'https://github.com/unjs/ofetch' },
  { package: 'ol', license: 'BSD-2-Clause', version: '10.7.0', author: 'OpenLayers Contributors', link: 'https://github.com/openlayers/openlayers' },
  { package: 'pinia', license: 'MIT', version: '3.0.4', author: 'Eduardo San Martin Morote', link: 'https://github.com/vuejs/pinia' },
  { package: 'reka-ui', license: 'MIT', version: '2.6.0', author: 'Reka contributors', link: 'https://github.com/reka-ui/reka-ui' },
  { package: 'uuid', license: 'MIT', version: '13.0.0', author: 'UUID contributors', link: 'https://github.com/uuidjs/uuid' },
  { package: 'vue', license: 'MIT', version: '3.5.24', author: 'Evan You', link: 'https://github.com/vuejs/core' },
  { package: 'vue-chartjs', license: 'MIT', version: '5.3.3', author: 'Chart.js contributors', link: 'https://github.com/react-chartjs-2/vue-chartjs' },
  { package: 'vue-router', license: 'MIT', version: '4.6.3', author: 'Vue.js team', link: 'https://github.com/vuejs/router' },
  { package: 'vuedraggable', license: 'MIT', version: '4.1.0', author: 'SortableJS', link: 'https://github.com/SortableJS/Vue.Draggable' },
])
</script>

<template>
  <div class="content-wrapper">
    <NavigationBack />
    <div class="oss-licenses-page">
      <h1 class="page-title">
        Лицензии Open Source
      </h1>
      <p class="page-description">
        Это приложение создано с использованием следующего программного обеспечения с открытым исходным кодом. Мы благодарны авторам за их вклад.
      </p>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Пакет</th>
              <th>Лицензия</th>
              <th>Версия</th>
              <th>Автор</th>
              <th>Ссылка</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lib in licenses" :key="lib.package">
              <td data-label="Пакет">
                {{ lib.package }}
              </td>
              <td data-label="Лицензия">
                {{ lib.license }}
              </td>
              <td data-label="Версия">
                {{ lib.version }}
              </td>
              <td data-label="Автор" class="author-cell">
                {{ lib.author }}
              </td>
              <td data-label="Ссылка" class="link-cell">
                <a :href="lib.link" target="_blank" rel="noopener noreferrer">{{ lib.link }}</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.oss-licenses-page {
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  margin: 0;
}

.page-description {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  max-width: 700px;
  line-height: 1.6;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-secondary-color);
  border-radius: var(--r-m);
  background-color: var(--bg-secondary-color);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-secondary-color);
}

thead tr {
  background-color: var(--bg-tertiary-color);
}

th {
  font-weight: 600;
  color: var(--fg-secondary-color);
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background-color: var(--bg-hover-color);
}

td {
  color: var(--fg-primary-color);
}

.author-cell,
.link-cell {
  word-break: break-all;
  min-width: 300px;
}

.link-cell a {
  color: var(--fg-accent-color);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}

@include media-down(sm) {
  table {
    border: 0;
  }

  thead {
    display: none;
  }

  tr {
    display: block;
    margin-bottom: 1rem;
    border: 1px solid var(--border-secondary-color);
    border-radius: var(--r-m);
    overflow: hidden;
  }

  td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-align: right;
    padding: 10px 12px;

    &::before {
      content: attr(data-label);
      float: left;
      font-weight: 600;
      color: var(--fg-secondary-color);
      margin-right: 1rem;
    }

    &:last-child {
      border-bottom: 0;
    }
  }

  .author-cell,
  .link-cell {
    min-width: unset;

    a {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
