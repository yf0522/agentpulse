# vhs tape — generates docs/demo-tui.gif
# Install: brew install charmbracelet/tap/vhs
# Run:     vhs scripts/demo.tape

Output docs/demo-tui.gif

Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Tokyo Night"
Set Padding 20

Type "agentpulse seed" Sleep 400ms Enter
Sleep 1s
Type "agentpulse tui" Sleep 400ms Enter
Sleep 2s

Down Sleep 600ms
Down Sleep 600ms
Up   Sleep 500ms
Enter Sleep 2.5s
Escape Sleep 1.5s
Down Sleep 500ms
Enter Sleep 2.5s
Escape Sleep 1.5s

Type "q"
Sleep 500ms
