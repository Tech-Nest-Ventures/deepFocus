import { type Component, createSignal, Show } from 'solid-js'

const Versions: Component = () => {
  const [versions] = createSignal(window?.electron?.process?.versions)

  return (
    <Show when={versions}>
      <ul class="versions">
        <li class="electron-version">Electron v{versions().electron}</li>
        <li class="chrome-version">Chromium v{versions().chrome}</li>
        <li class="node-version">Node v{versions().node}</li>
      </ul>
    </Show>
  )
}

export default Versions
