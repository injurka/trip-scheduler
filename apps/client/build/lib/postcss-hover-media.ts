import type { AtRule, Container, Document, PluginCreator, Rule } from 'postcss'
import postcss from 'postcss'

const HOVER_REGEX = /(?<!:not\([^)]*):hover\b/

function isInsideHoverOrKeyframes(rule: Rule): boolean {
  let parent: Container | Document | undefined = rule.parent

  while (parent) {
    if (parent.type === 'atrule') {
      const atRule = parent as AtRule
      const isHoverMedia = atRule.name === 'media' && atRule.params.includes('hover')
      const isKeyframes = atRule.name === 'keyframes'

      if (isHoverMedia || isKeyframes)
        return true
    }

    parent = parent.parent
  }

  return false
}

function partitionSelectors(selectors: string[]): { hoverSelectors: string[], nonHoverSelectors: string[] } {
  const hoverSelectors: string[] = []
  const nonHoverSelectors: string[] = []

  for (const sel of selectors) {
    if (HOVER_REGEX.test(sel)) {
      hoverSelectors.push(sel)
    }
    else {
      nonHoverSelectors.push(sel)
    }
  }

  return { hoverSelectors, nonHoverSelectors }
}

export const postcssHoverMedia: PluginCreator<void> = () => {
  return {
    postcssPlugin: 'postcss-hover-media',
    Rule(rule) {
      if (!rule.selector || !HOVER_REGEX.test(rule.selector) || isInsideHoverOrKeyframes(rule))
        return

      const { hoverSelectors, nonHoverSelectors } = partitionSelectors(rule.selectors)

      if (hoverSelectors.length === 0)
        return

      const media = postcss.atRule({
        name: 'media',
        params: '(hover: hover) and (pointer: fine)',
      })

      const hoverRule = rule.clone({ selectors: hoverSelectors })
      media.append(hoverRule)

      if (nonHoverSelectors.length > 0) {
        rule.selectors = nonHoverSelectors
        rule.after(media)
      }
      else {
        rule.replaceWith(media)
      }
    },
  }
}

postcssHoverMedia.postcss = true
