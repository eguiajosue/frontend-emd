import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React from 'react'

const Home = () => {
  return (
    <>
      <h1 className='text-6xl'>Home</h1>
      <Link href={'/dashboard'}>
        <Button variant={'default'}>Go to Dashboard</Button>
      </Link>
    </>
  )
}

export default Home
