// Import libraries
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { Rhino3dmLoader } from "three/addons/loaders/3DMLoader.js"
import rhino3dm from "rhino3dm"
import { RhinoCompute } from "rhinocompute"

const definitionName = "rnd_node_color.gh"

// Set up sliders
const radius_slider = document.getElementById("radius")
radius_slider.addEventListener("mouseup", onSliderChange, false)
radius_slider.addEventListener("touchend", onSliderChange, false)

const count_slider = document.getElementById("count")
count_slider.addEventListener("mouseup", onSliderChange, false)
count_slider.addEventListener("touchend", onSliderChange, false)

const loader = new Rhino3dmLoader()
loader.setLibraryPath("https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/")

let rhino, definition, doc
rhino3dm().then(async (m) => {
  console.log("Loaded rhino3dm.")
  rhino = m // global

  RhinoCompute.url = "http://localhost:8081/" //if debugging locally.

  // load a grasshopper file!

  const url = definitionName
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  const arr = new Uint8Array(buffer)
  definition = arr

  init()
  compute()
})

/**
 * This function is responsible for gathering values and sending them to local compute server
 */
async function compute() {
  // Create and asign first parameter value
  const param1 = new RhinoCompute.Grasshopper.DataTree("Radius")
  param1.append([0], [radius_slider.valueAsNumber])

  // Create and asign second parameter value
  const param2 = new RhinoCompute.Grasshopper.DataTree("Count")
  param2.append([0], [count_slider.valueAsNumber])

  // clear values
  const trees = []
  trees.push(param1)
  trees.push(param2)

  // Run the definition
  const res = await RhinoCompute.Grasshopper.evaluateDefinition(
    definition,
    trees
  )

  doc = new rhino.File3dm()

  // hide spinner
  document.getElementById("loader").style.display = "none"

  //decode grasshopper objects and put them into a rhino document
  for (let i = 0; i < res.values.length; i++) {
    for (const [key, value] of Object.entries(res.values[i].InnerTree)) {
      for (const d of value) {
        const data = JSON.parse(d.data)
        const rhinoObject = rhino.CommonObject.decode(data)
        doc.objects().add(rhinoObject, null)
      }
    }
  }

  // go through the objects in the Rhino document

  let objects = doc.objects()
  for (let i = 0; i < objects.count; i++) {
    const rhinoObject = objects.get(i)

    // asign geometry userstrings to object attributes
    if (rhinoObject.geometry().userStringCount > 0) {
      const g_userStrings = rhinoObject.geometry().getUserStrings()

      //iterate through userData and store all userdata to geometry
      for (let j = 0; j < g_userStrings.length; j++) {
        rhinoObject
          .attributes()
          .setUserString(g_userStrings[j][0], g_userStrings[j][1])
      }

      // rhinoObject.attributes().setUserString(g_userStrings[0][0], g_userStrings[0][1])
    }
  }

  // clear objects from scene
  scene.traverse((child) => {
    if (!child.isLight) {
      scene.remove(child)
    }
  })

  const buffer = new Uint8Array(doc.toByteArray()).buffer
  loader.parse(buffer, function (object) {
    // go through all objects, check for userstrings and assing colors

    object.traverse((child) => {
      if (child.isLine) {
        if (child.userData.attributes.geometry.userStringCount > 0) {
          //get color from userStrings
          const colorData = child.userData.attributes.userStrings[0]
          const col = colorData[1]

          //convert color from userstring to THREE color and assign it
          const threeColor = new THREE.Color("rgb(" + col + ")")
          const mat = new THREE.LineBasicMaterial({ color: threeColor })
          child.material = mat
        }
      }
    })

    ///////////////////////////////////////////////////////////////////////
    // add object graph from rhino model to three.js scene
    scene.add(object)
  })
}

function onSliderChange() {
  // show spinner
  document.getElementById("loader").style.display = "block"
  compute()
}

// THREE BOILERPLATE //
let scene, camera, renderer, controls

/**
 * ThreeJS scene initiation with camera, rendered and lights setup
 */
function init() {
  // Listen to event of changin the screen size so camera can adjust
  window.addEventListener("resize", onWindowResize, false)

  // create a scene and a camera
  scene = new THREE.Scene()
  scene.background = new THREE.Color(1, 1, 1)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.z = -30

  // create the renderer and add it to the html
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  // add some controls to orbit the camera
  controls = new OrbitControls(camera, renderer.domElement)

  // add a directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff)
  directionalLight.intensity = 2
  scene.add(directionalLight)

  const ambientLight = new THREE.AmbientLight()
  scene.add(ambientLight)

  animate()
}

/**
 * Refresh the renfered every frame
 */
function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

/**
 * Adjust scene size to the window width and height
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  animate()
}

function meshToThreejs(mesh, material) {
  const loader = new THREE.BufferGeometryLoader()
  const geometry = loader.parse(mesh.toThreejsJSON())
  return new THREE.Mesh(geometry, material)
}
