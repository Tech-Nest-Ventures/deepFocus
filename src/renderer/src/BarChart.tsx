import { onMount, onCleanup, createSignal } from 'solid-js'
import {
  Chart as ChartJS,
  BarController,
  CategoryScale,
  BarElement,
  LinearScale,
  Tooltip,
  Title,
  Legend
} from 'chart.js'
import { Bar } from 'solid-chartjs'
import { Button } from './components/ui/button'
import { VsRefresh } from './components/ui/icons'
import { IpcRendererEvent } from 'electron'

const BarChart = () => {
  const [chartData, setChartData] = createSignal({
    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    datasets: [
      {
        label: 'Deep Work Hours',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }
    ]
  })

  const fetchDeepWorkData = () => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  const handleDataResponse = (_event: IpcRendererEvent, data: number[]) => {
    if (data && data.length) {
      console.log('Retrieved Data! ', data)
      setChartData((prevData) => ({
        ...prevData,
        datasets: [{ ...prevData.datasets[0], data }]
      }))
    } else {
      console.log('No data found for deep work hours.')
    }
  }

  onMount(() => {
    ChartJS.register(BarController, CategoryScale, BarElement, LinearScale, Tooltip, Title, Legend)
    fetchDeepWorkData()

    window?.electron.ipcRenderer.on('deep-work-data-response', handleDataResponse)

    // Listen for deep work reset and refresh the data
    window?.electron.ipcRenderer.on('deep-work-reset', fetchDeepWorkData)

    onCleanup(() => {
      window?.electron.ipcRenderer.removeListener('deep-work-data-response', handleDataResponse)
      window?.electron.ipcRenderer.removeListener('deep-work-reset', fetchDeepWorkData)
      window?.electron.ipcRenderer.removeAllListeners('fetch-deep-work-data')
    })
  })

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Hours'
        }
      }
    },
    plugins: {
      title: { display: true, text: 'Deep Work Hours' },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.raw === 0 ? 'Data coming soon' : `${context.raw} hours`
          }
        }
      }
    }
  }

  return (
    <div>
      <Button class="mt-2 px-4 rounded text-white" onClick={fetchDeepWorkData}>
        <VsRefresh />
      </Button>
      <Bar data={chartData()} options={chartOptions} width={400} height={400} />
    </div>
  )
}

export default BarChart
