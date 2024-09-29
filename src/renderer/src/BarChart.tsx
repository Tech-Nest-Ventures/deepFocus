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
  onMount(() => {
    ChartJS.register(BarController, CategoryScale, BarElement, LinearScale, Tooltip, Title, Legend)

    // Send the initial request to fetch deep work data
    window?.electron.ipcRenderer.send('fetch-deep-work-data')

    // Listen for the deep work data response and update the chart
    const deepWorkDataHandler = (event, data) => {
      if (data && data.length) {
        console.log('Retrieved Data! ', data)

        setChartData((prevData) => ({
          ...prevData,
          datasets: [
            {
              ...prevData.datasets[0],
              data: data
            }
          ]
        }))
      } else {
        console.log('No data found for deep work hours. Using default data.')
      }
    }

    window?.electron.ipcRenderer.on('deep-work-data-response', deepWorkDataHandler)

    // Clean up the event listener on unmount
    onCleanup(() => {
      window?.electron.ipcRenderer.removeListener('deep-work-data-response', deepWorkDataHandler)
    })
  })

  const chartOptions = {
    responsive: false,
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
      title: {
        display: true,
        text: 'Deep Work Hours'
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.raw
            return value === 0 ? 'Data coming soon' : `${value} hours`
          }
        }
      }
    }
  }
  return <Bar data={chartData()} options={chartOptions} width={700} height={700} />
}

export default BarChart
