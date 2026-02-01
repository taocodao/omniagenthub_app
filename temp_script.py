from pathlib import Path
text = Path('pages/ChatHome_Business.tsx').read_text(encoding='utf-8')
needle = "<LocalizedText name='NotebookLM (Demo)' />"
idx = text.find(needle)
print('index', idx)
if idx != -1:
    start = text.rfind('<div className={styles.tooltipWrapper}>', 0, idx)
    end = text.find('</div>', idx)
    snippet = text[start:end+6]
    print('---SNIPPET---')
    print(snippet)
