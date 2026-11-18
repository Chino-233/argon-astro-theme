(() => {
  window.ArgonBlockEditor = {
    mount(container, source, options) {
      const { createElement: el, createPortal, createRoot, useState, useEffect } = wp.element;
      const { BlockEditorProvider, BlockList, BlockTools, WritingFlow, ObserveTyping, BlockInspector, Inserter, BlockEditorKeyboardShortcuts } = wp.blockEditor;
      const { SlotFillProvider, Popover, Button } = wp.components;
      const allowedBlocks = ['core/paragraph', 'core/heading', 'core/list', 'core/list-item', 'core/quote', 'core/pullquote', 'core/code', 'core/preformatted', 'core/html', 'core/image', 'core/gallery', 'core/audio', 'core/video', 'core/table', 'core/separator', 'core/spacer', 'core/group', 'core/columns', 'core/column', 'core/buttons', 'core/button', 'core/details', 'core/verse'];
      const blockTitles = {
        'core/paragraph': '段落', 'core/heading': '标题', 'core/list': '列表', 'core/list-item': '列表项',
        'core/quote': '引用', 'core/pullquote': '引文', 'core/code': '代码', 'core/preformatted': '预格式化文本',
        'core/html': '自定义 HTML', 'core/image': '图片', 'core/gallery': '画廊', 'core/audio': '音频',
        'core/video': '视频', 'core/table': '表格', 'core/separator': '分隔符', 'core/spacer': '空白',
        'core/group': '组', 'core/columns': '分栏', 'core/column': '栏', 'core/buttons': '按钮组',
        'core/button': '按钮', 'core/details': '详情', 'core/verse': '诗歌',
      };
      wp.hooks.addFilter('blocks.registerBlockType', 'argon/chinese-titles', (settings, name) => (
        blockTitles[name] ? { ...settings, title: blockTitles[name], description: '' } : settings
      ));
      wp.blockLibrary.registerCoreBlocks();
      function parse(html) {
        if (/<!--\s*wp:/.test(html)) return wp.blocks.parse(html);
        return wp.blocks.rawHandler({ HTML: html, mode: 'BLOCKS' });
      }
      let blocks = parse(source);
      if (!blocks.length) blocks = [wp.blocks.createBlock('core/paragraph')];
      let replaceBlocks;
      let history = [wp.blocks.serialize(blocks)];
      let position = 0;
      let lastEdit = 0;

      function update(next) {
        const previous = wp.blocks.serialize(blocks);
        const serialized = wp.blocks.serialize(next);
        blocks = next;
        replaceBlocks?.(next);
        if (serialized === previous) return;
        const now = Date.now();
        if (position > 0 && position === history.length - 1 && now - lastEdit < 700) history[position] = serialized;
        else {
          history = history.slice(0, position + 1);
          history.push(serialized);
          if (history.length > 100) history.shift();
          position = history.length - 1;
        }
        lastEdit = now;
        options.onChange();
      }

      function restore(nextPosition) {
        if (nextPosition < 0 || nextPosition >= history.length) return;
        position = nextPosition;
        blocks = wp.blocks.parse(history[position]);
        replaceBlocks?.(blocks);
        lastEdit = 0;
        options.onChange();
      }

      function MediaUpload(props) {
        return props.render({ open: () => options.onMedia((media) => props.onSelect(props.multiple ? [media] : media)) });
      }
      wp.hooks.addFilter('editor.MediaUpload', 'argon/media', () => MediaUpload);

      const settings = {
        allowedBlockTypes: allowedBlocks,
        hasFixedToolbar: false,
        hasUploadPermissions: true,
        maxUploadFileSize: 20 * 1024 * 1024,
        imageSizes: [{ slug: 'full', name: '完整尺寸' }],
        enableCustomFields: false,
        __experimentalBlockPatterns: [],
        __experimentalBlockPatternCategories: [],
        __experimentalFeatures: {
          color: { text: true, background: true, custom: true, defaultPalette: false },
          typography: { fontSize: true, customFontSize: true, lineHeight: true },
        },
        colors: [
          { name: '黑色', slug: 'black', color: '#1d2327' },
          { name: '白色', slug: 'white', color: '#ffffff' },
          { name: '主题蓝', slug: 'primary', color: '#2271b1' },
          { name: '红色', slug: 'red', color: '#cf2e2e' },
          { name: '灰色', slug: 'gray', color: '#646970' },
        ],
        mediaUpload({ filesList, onFileChange, onError }) {
          Promise.all([...filesList].map(options.uploadFile))
            .then((items) => onFileChange(items.map((item) => ({ ...item, type: item.mime.split('/')[0], alt: '', sizes: { full: { url: item.url } } }))))
            .catch((error) => onError?.({ message: error.message }));
        },
      };

      function App() {
        const [value, setValue] = useState(blocks);
        replaceBlocks = setValue;
        useEffect(() => {
          const onKey = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
              event.preventDefault();
              event.stopPropagation();
              restore(position + (event.shiftKey ? 1 : -1));
            }
          };
          container.addEventListener('keydown', onKey, true);
          return () => container.removeEventListener('keydown', onKey, true);
        }, []);
        return el(SlotFillProvider, {},
          el(BlockEditorProvider, { value, onInput: update, onChange: update, settings },
            el('div', { className: 'argon-block-toolbar' },
              el(Inserter, {}),
              el(Button, { onClick: () => restore(position - 1), disabled: position === 0, icon: 'undo', label: '撤销' }),
              el(Button, { onClick: () => restore(position + 1), disabled: position >= history.length - 1, icon: 'redo', label: '重做' })
            ),
            el(BlockTools, {}, el(WritingFlow, {}, el(ObserveTyping, {},
              el('div', { className: 'editor-styles-wrapper' }, el(BlockList, { className: 'argon-block-list' }))
            ))),
            el(BlockEditorKeyboardShortcuts, {}),
            createPortal(el(BlockInspector, {}), document.getElementById('block-inspector-panel')),
            el(Popover.Slot, {})
          )
        );
      }
      const root = createRoot(container);
      root.render(el(App));
      return {
        getContent(format) {
          const html = wp.blocks.serialize(blocks);
          if (format?.format !== 'text') return html;
          return new DOMParser().parseFromString(html, 'text/html').body.textContent;
        },
        setContent(html) {
          blocks = parse(html);
          if (!blocks.length) blocks = [wp.blocks.createBlock('core/paragraph')];
          history = [wp.blocks.serialize(blocks)];
          position = 0;
          replaceBlocks?.(blocks);
        },
        insertContent(html) {
          const additions = parse(html);
          const selected = wp.data.select('core/block-editor').getSelectedBlockClientId();
          const index = selected ? wp.data.select('core/block-editor').getBlockIndex(selected) + 1 : blocks.length;
          wp.data.dispatch('core/block-editor').insertBlocks(additions, index);
        },
        focus() { container.querySelector('[contenteditable=true]')?.focus(); },
        uploadImages() { return Promise.resolve(); },
      };
    },
  };
})();
