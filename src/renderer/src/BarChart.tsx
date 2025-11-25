import { onMount, onCleanup, createSignal, type JSX } from 'solid-js'
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

const BarChart = (): JSX.Element => {
  const [chartData, setChartData] = createSignal({
    labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    datasets: [
      {
        label: 'DEEP WORK HOURS',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(255, 255, 255, 1)',
        borderColor: 'rgba(255, 255, 255, 1)',
        borderWidth: 2
      }
    ]
  })

  const fetchDeepWorkData = (): void => {
    window?.electron?.ipcRenderer.send('fetch-deep-work-data')
  }

  const handleDataResponse = (_event: IpcRendererEvent, response: number[] | { data: number[]; labels: string[] }): void => {
    // Handle both old format (array) and new format (object with data and labels)
    let data: number[]
    let labels: string[]
    
    if (Array.isArray(response)) {
      // Old format - just an array of numbers
      data = response
      labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    } else {
      // New format - object with data and labels
      data = response.data
      labels = response.labels
    }
    
    if (data && data.length) {
      console.log('Retrieved Data! ', data, 'Labels:', labels)
      setChartData((prevData) => ({
        labels,
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
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'rgba(255, 255, 255, 1)',
          font: {
            family: "'JetBrains Mono', 'SF Mono', 'Monaco', monospace",
            size: 12,
            weight: 700
          },
          callback: function (value: number | string): string {
            return String(value) + 'H'
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 1
        },
        border: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 2
        },
        title: {
          display: true,
          text: 'HOURS',
          color: 'rgba(255, 255, 255, 1)',
          font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: 700
          },
          padding: {
            top: 5,
            bottom: 5
          }
        }
      },
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 1)',
          font: {
            family: "'JetBrains Mono', 'SF Mono', 'Monaco', monospace",
            size: 12,
            weight: 700
          }
        },
        grid: {
          display: false
        },
        border: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 2
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 1)',
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: 700
          },
          padding: 10,
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 20
        }
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 1)',
        titleColor: 'rgba(255, 255, 255, 1)',
        bodyColor: 'rgba(255, 255, 255, 1)',
        borderColor: 'rgba(255, 255, 255, 1)',
        borderWidth: 2,
        padding: 16,
        titleFont: {
          family: "'Inter', sans-serif",
          size: 11,
          weight: 700
        },
        bodyFont: {
          family: "'JetBrains Mono', 'SF Mono', 'Monaco', monospace",
          size: 12,
          weight: 700
        },
        callbacks: {
          title: function (context: Array<{ label: string }>): string {
            return context[0].label
          },
          label: function (context: { raw: number }): string {
            if (context.raw === 0) {
              return 'NO DATA'
            }
            const hours = context.raw as number
            const wholeHours = Math.floor(hours)
            const minutes = Math.round((hours - wholeHours) * 60)
            if (minutes === 0) {
              return `${wholeHours} HOUR${wholeHours !== 1 ? 'S' : ''}`
            }
            return `${wholeHours}H ${minutes}M`
          }
        }
      }
    }
  }

  return (
    <div class="space-y-swiss-6">
      {/* Swiss Typography: Clean button styling, extreme whitespace */}
      <div class="flex justify-start items-center gap-swiss-4 mb-swiss-6">
        <Button variant="outline" size="sm" onClick={fetchDeepWorkData}>
          <VsRefresh />
        </Button>
      </div>
      {/* Swiss Typography: Chart container with proper spacing */}
      <div class="w-full" style={{ height: '400px' }}>
        <Bar data={chartData()} options={chartOptions} />
      </div>
    </div>
  )
}

export default BarChart
