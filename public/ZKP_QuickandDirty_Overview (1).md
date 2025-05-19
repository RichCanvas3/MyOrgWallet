# Zero Knowedge Proofs: A Quick and Dirty Summary

## What is it conceptually?

### Overview
A Zero Knowedge Proof (ZKP), is a method of cryptography that allows one party to convince another of the validity of a statement without exposing the actual statement. It's basically a way for me to convince you that I have a driver's license (or some general credential/verification) without actually showing it to you. 

### A Quick Example
Let's imgaine two people, one red-green colorblind and one not, have two balls. One is green and one is red but they are phycisally identical in all aspects besidees color. How could person 1 (not colorblind) convince person 2 (coloblind) that the two balls have different colors? In this scenario we will have person 2 hold one ball in each hand, then place their hands behind their back and either switch the balls or not. After this switch does or does not happen, person 2 takes their hands out from behind thier back and person 1 has to tell them if the balls were switched. 

Of course, person 1 tells them the correct answer in this case because they are not colorblind and the balls are not the same color. Statistically, if the balls WERE the same color, person 1 would only guess right around 50% of the time, but COULD guess right for this singular trial. So, to mitigate this, the two perform a myriad of trials (lets say, 300,000 trials). Once the trials are over and the data is analyzed person 2 will be convinced that the balls are differently colored as long as the data statistically converges to a percentage of sucess well above 50%. Person 2, however, never learns which ball is which color, meaning they gained no factual knowedge in the echange, therefore making this conceptually a ZKP.

### An Actual Definition
A ZKP must statify three core properties:
* Completeness: If the statment is true, an hoest verifier (person 2) will be convinced by an honest prover (person 1).
* Soundness: If the statement is false, then the dishonest prover has an extremely small, near zero chance of convincing a verifier.
* Zero-Knowedge: The verifier doesn't learn anything other than that the validity of the statement. The key here is that they DO NOT learn the statement in any way shape or form. 

### Lets look at some brief code!
So the big question on your mind now is probably: How? Well, it requires an insane amount of calculation to classically preform a zero knowledge proof, but code wise it can be fairly easy to understand with simplified python examples of course. 

In any case, here's a simple python script which simulats an entire ZK age-verifcation transaction using a hash-chain method: 
```sh
import hashlib;
import sys;

age_actual=25
age_to_prove=18
seed=b"12345667"

proof = hashlib.md5(seed)
encrypted_age = hashlib.md5(seed)

for i in range(1,1+age_actual-age_to_prove):
	proof = hashlib.md5(proof.digest())

for i in range(1,age_actual+1):
	encrypted_age = hashlib.md5(encrypted_age.digest())

verfied_age=proof

for i in range(0,age_to_prove):
	verfied_age = hashlib.md5(verfied_age.digest())



print ("Peggy's Age:\t\t",age_actual)
print ("Age to prove:\t\t",age_to_prove)

print ("....")


print ("Proof:\t\t",proof.hexdigest())
print ("Encr Age:\t",encrypted_age.hexdigest())
print ("Verified Age:\t",verfied_age.hexdigest())

if (encrypted_age.hexdigest()==verfied_age.hexdigest()):
	print ("You have proven your age ... please come in")
else:
	print ("You have not proven you age!")
```
Lets go through this step by step!

1. An actual age is known by the prover and a required age is given to the prover in these lines (note: neither the prover nor the verifier know the seed value):
```sh
age_actual=25
age_to_prove=18
seed=b"12345667"
```
2. The prover hashes the seed value once, encrypting it and sets the encrypted values equal to both the 'proof' and the 'encrypted_age':
```sh
proof = hashlib.md5(seed)
encrypted_age = hashlib.md5(seed)
```
3. The prover hashes the proof value a subsequent 8 times (1+25-18=8), and hashes the encrypted_age value a subsequent 26 times (1+25=26). Note that the difference between the two hashing amounts is 18, or the required age:
```sh
for i in range(1,1+age_actual-age_to_prove):
	proof = hashlib.md5(proof.digest())

for i in range(1,age_actual+1):
	encrypted_age = hashlib.md5(encrypted_age.digest())
```
4. The encypted age and proof are given to the verifier (this is not shown within the code, merely implied by the nature of a ZKP transaction)

5. The verifier hashes the proof a subsequent 18 times:
```sh
verfied_age=proof

for i in range(0,age_to_prove):
	verfied_age = hashlib.md5(verfied_age.digest())
```
6. The verifier compares the encrypted_age value and the resulting verified_age value, verifiying if the prover is over 18:
```sh
if (encrypted_age.hexdigest()==verfied_age.hexdigest()):
	print ("You have proven your age ... please come in")
else:
	print ("You have not proven you age!")
```

During this process, the verifier never saw the actual age of the prover, nor did either see the seed phrase. This means that the verifier cannot trace the data back to the seed phrase, and therefore cannot possibly know the age of the prover. The verfier gains no actual knowedge, the prover cannot cheat the system (as long as whatever was used to give the age value was inherently honest), and the prover will always be able to prove a true statement. Thus, we have an, albeit simple, ZKP!

(credit to https://asecuritysite.com/encryption/age for this extremely simple to follow program)

## Digging a little deeper

### Circuits
```sh
pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

template Multiplier2Alt () {
  signal input a;
  signal input b;
  signal output c;
  
  component isZeroCheck = IsZero();
  isZeroCheck.in <== (a-1)*(b-1);
  isZeroCheck.out === 0;

  c <== a * b;
}
```
A cicuit, like the one above, is a specialized piece of code that outputs *something* under specific algebraic and logical constraints specified within it. These alone do not make ZKPs, though. In order to make a ZKP, a cicuit must go through two 'trusted setup' phases. These phases create both a circuit independent and dependent set of proving and verification keys. These keys are needed to generate and verify a proof made from the circuit itself. Upon generation, a proof made from the circuit above may look something like this: (note, generation require specified inputs like '1', '45', etc)
```sh
{
 "pi_a": [
  "11286145479941409040760172400279137226579316571525708489242938180420133912721",
  "2677980391406184394281401028358661257926629533465463283912309083443499810514",
  "1"
 ],
 "pi_b": [
  [
   "14933489319759420724714072895050129333061429239042510916124613560263890166123",
   "19291082832739804284706487860219996372397892474526061183889444784355969995454"
  ],
  [
   "17715367354997881389315171562846576950028736763851039226590999168416203934526",
   "5545195240303007151205455568873794010326245379015707786879980966455851850517"
  ],
  [
   "1",
   "0"
  ]
 ],
 "pi_c": [
  "18019398854750223185711136993582188809149742263022056204806841459974430861986",
  "10809909058296549800214197114044268281695997233387215102456672882116563924914",
  "1"
 ],
 "protocol": "groth16",
 "curve": "bn128"
}
```
It looks a lot like how the hashed seed code might have looked in the python program! However, it is actually a set of mathematical objects. It's also quite small for something of it's cryptographical strength. This proof will be used along with the verification key mentioned earlier to verify whatever original statement was inputted into the circuit to get the proof. 

When the proof is verified, if everything is intact and the statment is correct (it must be correct for the program to have got this far, since it would have been stopped at the generation step), then the verifier will be convinced of whatever the prover is proving as it will come back as True. 

Here's a good diagram from https://zkintro.com/articles/programming-zkps-from-zero-to-hero#third-iteration, an amazing introduction to ZPK's which we reccomend if you are interested in a much more thorough explanation on the topic!

![02_example1_verify_proof](https://github.com/user-attachments/assets/a4337880-0929-4060-90a1-8cd1c23e6b38)

### How can this go wrong (or more accurately: How it can't)
One of the main components of a ZKP is its *soundness*. According to the definiiton we discussed way earlier, this measn that no person with a false claim can cheat the verifier. So how do we make sure of our soundness? By using a circuit, we don't have to do anything! It was touched on above, but the circuit verifies the truth of a statement upon generation. Referencing the above circuit, if we wanted our c to be 33 and we put our a as 2 and out b as 13, then no proof would be generated! The circuit would error and refuse to say anything about our inputs since they don't match the output!

That's all great, but what if we try to be a bit conniving? Let's say we sneakily change the desired output value to be 26 and then generate our proof with those incorrect inputs. Unsurprisingly, the circuit would run through, say 'Yes, 2 * 13 = 26,' and generate a proof saying so. Now, we'll go and change back the output to 33, with the proof alreayd havign said our incorrect values are clean. This is where the circuit shines, as upon verifcation it actually checks the output value which is recorded in the proof alongside the inputs! In doing so, it see that 33 does not equal 26 and immediately rejects the proof, returning False. 

What else could we do? We could try to change the proof itself, if we're really trying to cheat the system. Let's say we just change the mathematical objects to match those which would indicate truth. It's easier said than done, though, as each mathematcial object is created using a seed phrase which nobody knows at this point. So we can't reverse engineer an object lickety split to fool the verifier, and thus can't use this method of proof-editing to cheat. We could, of course, try to guess. It would, however, take a miracle to guess the value of the object due to the sheer amount and variance of digits and seperate integer objects involved. For just one of the integers shown in the above proof, there are 84590643846578180 (84 quadrillion) permutations. 

The overall takeaway here is that we can't effectively cheat the system through anything less thna random chance and practically impossible guesses, showing the soundness of a ZKP.

## Major Tech Used
* Just
* Circom
* Rust
* SnarkJS






