import { onMount, onCleanup, createSignal } from 'solid-js'
import * as echarts from 'echarts'

const BarChart = () => {
  let chartDiv: HTMLElement | null | undefined
  const [chartData, setChartData] = createSignal<number[]>([0, 0, 0, 0, 0, 0, 0]) // Default values for the week

  onMount(() => {
    // Initialize the chart
    const myChart = echarts.init(chartDiv)
    // Request deep work data from the main process
    window?.electron.ipcRenderer.send('fetch-deep-work-data')

    // Function to set chart options dynamically
    const setChartOptions = (data: number[]) => {
      const options = {
        title: {
          text: 'Deep Work Hours'
        },
        animationDuration: 3000,
        tooltip: {
          trigger: 'axis',
          formatter: function (params: any) {
            // Check if the value is 0 and display a custom message
            const dataPoint = params[0].data
            return dataPoint === 0 ? 'Data coming soon' : `${dataPoint} hours`
          },
          backgroundColor: 'rgba(50, 50, 50, 0.8)',
          textStyle: {
            color: '#fff'
          },
          extraCssText: 'box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);'
        },
        xAxis: {
          type: 'category',
          data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: function (value: number) {
              return value === 0 ? '' : value // Don't show the 0 label on y-axis
            }
          }
        },
        series: [
          {
            name: 'Hours',
            type: 'bar',
            data: data,
            itemStyle: {
              normal: {
                opacity: 0.8, // Slight blur effect for all bars
                color: function (params: any) {
                  // Use a custom color for 0-value bars to indicate that data is coming
                  return params.data === 0 ? 'rgba(255, 165, 0, 0.5)' : 'rgba(60, 120, 216, 1)'
                }
              }
            }
          }
        ]
      }

      // Set the options to the chart
      myChart.setOption(options)
    }

    // Listen for the deep work data response
    window?.electron.ipcRenderer.on('deep-work-data-response', (event, data) => {
      if (data && data.length) {
        console.log('Retrieved Data! ', data)
        setChartData(data) // Update the chart data
        setChartOptions(data)
      } else {
        // Handle case where no data is available
        console.log('No data found for deep work hours. Using default data.')
        setChartOptions(chartData())
      }
    })

    // Add resize listener to make the chart responsive
    window.addEventListener('resize', () => {
      myChart.resize()
    })

    // Clean up the chart on unmount
    onCleanup(() => {
      window?.electron.ipcRenderer.removeAllListeners('deep-work-data-response') // Clean up IPC listener
      myChart.dispose()
    })
  })

  return <div ref={chartDiv} style={{ width: '100%', height: '500px' }}></div>
}

export default BarChart
