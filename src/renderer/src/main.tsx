import './assets/main.css'

import { render } from 'solid-js/web'
import App from './App'
console.log('inside Main.tsx')

render(() => <App />, document.getElementById('root') as HTMLElement)
