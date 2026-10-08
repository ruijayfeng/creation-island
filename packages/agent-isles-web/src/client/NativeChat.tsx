import { useLayoutEffect, useRef } from 'react'
import type { AgentIslesTranslate } from './locales.js'

/** Lay out the existing DSH outlet without remounting its scoped React tree. */
export function NativeChat({ sessionId, t }: { sessionId: string; t: AgentIslesTranslate }) {
  const seat = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = seat.current
    if (!element) return
    const style = document.createElement('style')
    style.dataset.agentIslesNativeChat = ''
    document.head.append(style)
    const place = () => {
      const box = element.getBoundingClientRect()
      const clip = element.closest('.ci-body')?.getBoundingClientRect()
      const layer = Number(getComputedStyle(element.closest('aside') ?? element).zIndex) || 20
      const inset = clip ? `${Math.max(0,clip.top-box.top)}px ${Math.max(0,box.right-clip.right)}px ${Math.max(0,box.bottom-clip.bottom)}px ${Math.max(0,clip.left-box.left)}px` : '0px'
      style.textContent = `
        [data-agent-isles-town] [data-slot="conversation"] {
          --dsw-alias-bg-base: #fffdf6;
          --dsw-specific-input-major: #f0eee1;
          --dsw-specific-bubble: #e8eddf;
          --dsw-specific-menu: #fffdf6;
          --dsw-specific-selector: #e3e8d9;
          --dsw-specific-tip: #eeefdf;
          --dsw-alias-label-caption: #687961;
          --dsw-alias-button-info-fill: #22675b;
          --dsw-alias-button-info-hover: #1b554a;
          --dsw-alias-bg-layer-1: #f8f6ec;
          --dsw-alias-bg-layer-2: #efeee3;
          --dsw-alias-bg-layer-3: #e7ebdf;
          --dsw-alias-bg-overlay: #fffdf6;
          --dsw-alias-label-primary: #24352f;
          --dsw-alias-label-primary-foreground: #24352f;
          --dsw-alias-label-primary-bluish: #24352f;
          --dsw-alias-label-secondary: #586b56;
          --dsw-alias-label-tertiary: #6b7962;
          --dsw-alias-label-dimmed: #73806b;
          --dsw-alias-label-primary-dimmed: #73806b;
          --dsw-alias-border-l1: #d3dccb;
          --dsw-alias-border-l2: #dce2d3;
          --dsw-alias-border-l3: #e5e7da;
          --dsw-alias-border-l4: #e5e7da;
          --dsw-alias-interactive-bg-hover: #eaf0e3;
          --dsw-alias-interactive-bg-active: #e0e9d8;
          --dsw-alias-button-floating-fill: #f4f2e6;
          --dsw-alias-button-floating-hover: #e8eddf;
          --dsw-alias-button-tool-bar-fill: #f6f4e9;
          --dsw-alias-button-elevated-fill: #fffdf6;
          --dsw-alias-brand-primary: #22675b;
          --dsw-alias-brand-text: #22675b;
          --dsw-alias-link: #22675b;
          --dsw-alias-markdown-inline-code: #e9eddf;
          --dsw-alias-markdown-code-block: #edf0e5;
          --dsw-alias-markdown-code-block-banner: #e4e9d9;
          color: #24352f;
          display: block !important; position: fixed; z-index: ${layer+1};
          left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;
          visibility: visible; pointer-events: auto; overflow: hidden; clip-path: inset(${inset});
        }
        [data-agent-isles-town] [data-slot="conversation"] > [data-phase] {
          --dsh-chat-content-width: 100%; --dsh-composer-side-clearance: 0px;
          height: 100%; min-height: 0;
          --dsw-alias-bg-base: #fcfdf8; background: #fcfdf8;
        }
        [data-agent-isles-town] [data-slot="conversation.session.header"],
        [data-agent-isles-town] [data-width-handle] { display: none !important; }
        /* Workspace changes must go through the island project menu. Keep the
           native composer, model, permission and attachment controls intact. */
        [data-agent-isles-town] :is([aria-label="选择工作区"], [aria-label="Select workspace"]) { display: none !important; }
        [data-agent-isles-town]:not([data-details-collapsed]) [data-slot="details"] {
          display: block !important; position: fixed; z-index: ${layer+2};
          top: ${box.top}px; right: ${Math.max(0, window.innerWidth - box.right)}px;
          width: ${box.width}px; height: ${box.height}px;
          background: var(--dsw-alias-bg-base); visibility: visible; pointer-events: auto;
        }
      `
    }
    const observer = new ResizeObserver(place)
    observer.observe(element)
    // Tutorial disclosures and the preview can move the seat without resizing it.
    const panel = element.closest('aside')
    if (panel) observer.observe(panel)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    place()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      style.remove()
    }
  }, [sessionId])
  return <div className="town-native-chat-seat" ref={seat} aria-label={t('history.nativeChat')} />
}
