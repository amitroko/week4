import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"
import Head from "next/head"
import React, { useEffect } from "react"
import styles from "../styles/Home.module.css"
import { Formik } from "formik";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"

export default function Home() {
    useEffect(() => {
        listenForNewGreeting();
    });
    const [logs, setLogs] = React.useState("Connect your wallet and greet!");
    const [lastGreeting, setLastGreeting] = React.useState("");

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    async function listenForNewGreeting() {
        const provider = new providers.JsonRpcProvider("http://localhost:8545");
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider);

        contract.on("NewGreeting", (greeting) => {
            setLastGreeting(utils.parseBytes32String(greeting));
        });
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <Formik
                    initialValues={{ name: "", age: "", address: "" }}
                    validate={values => {
                        const errors = {
                            name: "",
                            age: "",
                            address: ""
                        };
                        if (!values.name) {
                        errors.name = 'Required';
                        } else if (
                            !/^[a-z ,.'-]+$/i.test(values.name)
                        ) {
                        errors.name = 'Invalid name';
                        }
                        if (!values.age) {
                            errors.age = 'Required';
                        } else if (
                            !/^[0-9]*$/.test(values.age)
                        ) {
                            errors.age = 'Invalid age';
                        }
                        if (!values.address) {
                            errors.address = 'Required';
                        } else if (
                            !/^0x[a-fA-F0-9]{40}$/.test(values.address)
                        ) {
                            errors.address = 'Invalid hexadecimal address';
                        }
                        return errors;
                    }}
                >
                    {({
                        values,
                        errors,
                        handleChange,
                    }) => (
                        <form className={styles.myform} onSubmit={(e) => {
                                e.preventDefault();
                                if (!errors.name && !errors.age && !errors.address) {
                                    console.log(JSON.stringify(values, null, 2))
                                }
                            }
                        }>
                            <label className={styles.formlabel}>Name</label>
                            <input
                                type="name"
                                name="name"
                                onChange={handleChange}
                                value={values.name}
                                autoComplete="off"
                            />
                            <div className={styles.formerror}>{errors.name}</div>
                            <label className={styles.formlabel}>Age</label>
                            <input
                                type="age"
                                name="age"
                                onChange={handleChange}
                                value={values.age}
                                autoComplete="off"
                            />
                            <div className={styles.formerror}>{errors.age}</div>
                            <label className={styles.formlabel}>Address</label>
                            <input
                                type="address"
                                name="address"
                                onChange={handleChange}
                                value={values.address}
                                autoComplete="off"
                            />
                            <div className={styles.formerror}>{errors.address}</div>
                            <button type="submit">
                                Submit
                            </button>
                        </form>
                    )}
                </Formik>
                <div className={styles.eventtext}>
                    <h3>Last Greeting:</h3>
                    {lastGreeting}
                </div>
            </main>
        </div>
    )
}
